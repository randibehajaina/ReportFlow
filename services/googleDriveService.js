const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const stream = require('stream');

/**
 * Recherche automatique du fichier de clé du Compte de Service dans le projet.
 * Prend en charge :
 * 1. service-account.json
 * 2. credentials.json
 * 3. reportflow-*.json (nom généré par défaut par Google Cloud)
 *
 * @returns {string|null} Chemin absolu du fichier de clé trouvé, ou null.
 */
function trouverFichierCle() {
  const racineProjet = path.join(__dirname, '..');
  const fichiersRacine = fs.readdirSync(racineProjet);

  const fichierCle = fichiersRacine.find((nom) => 
    nom === 'service-account.json' ||
    nom === 'credentials.json' ||
    (nom.startsWith('reportflow-') && nom.endsWith('.json'))
  );

  return fichierCle ? path.join(racineProjet, fichierCle) : null;
}

/**
 * Initialise le client authentifié Google Drive v3 via Compte de Service.
 *
 * @returns {import('googleapis').drive_v3.Drive | null} Instance Google Drive API authentifiée ou null si non configuré.
 */
function initialiserGoogleDrive() {
  try {
    // Cas 1 : OAuth 2.0 (Recommandé pour compte personnel Google @gmail.com avec quota personnel)
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (clientId && clientSecret && refreshToken) {
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost:3001/oauth2callback'
      );
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      return { drive: google.drive({ version: 'v3', auth: oauth2Client }), mode: 'oauth2' };
    }

    // Cas 2 : Fichier JSON Compte de Service (Google Workspace / Shared Drives)
    const cheminCle = trouverFichierCle();
    if (cheminCle && fs.existsSync(cheminCle)) {
      const auth = new google.auth.GoogleAuth({
        keyFile: cheminCle,
        scopes: ['https://www.googleapis.com/auth/drive']
      });

      return { drive: google.drive({ version: 'v3', auth }), mode: 'service_account' };
    }

    // Cas 3 : Variables d'environnement directes (.env)
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;

    if (clientEmail && privateKeyRaw) {
      const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/drive']
      });

      return { drive: google.drive({ version: 'v3', auth }), mode: 'service_account' };
    }

    return null;
  } catch (err) {
    console.warn('[GoogleDriveService] Erreur lors de l\'initialisation :', err.message);
    return null;
  }
}

/**
 * Téléverse un document Word (.docx) sous forme de Buffer en mémoire vive
 * vers Google Drive et récupère son URL d'ouverture et d'édition dans Google Docs.
 *
 * @param {Object} params
 * @param {string} params.nomFichier Nom du fichier avec extension .docx (ex : Compte-rendu-Client-Date.docx)
 * @param {Buffer} params.buffer Buffer binaire du fichier Word généré par wordService
 * @param {string} [params.dossierId] Identifiant optionnel du dossier Google Drive cible
 * @returns {Promise<{ succes: boolean, fileId: string, webViewLink: string, nom: string, modeDemo?: boolean }>}
 */
async function televerserDocumentWord({ nomFichier, buffer, dossierId }) {
  const configDrive = initialiserGoogleDrive();
  const folderIdCible = dossierId || process.env.GOOGLE_DRIVE_FOLDER_ID || null;

  // Mode Démo / Fallback gracieux si aucune clé Google Drive n'est encore configurée
  if (!configDrive) {
    console.log('[GoogleDriveService] Mode Démo / Simulation actif : aucun identifiant Google Drive configuré.');
    const fauxId = `drive-mock-${Date.now()}`;
    return {
      succes: true,
      modeDemo: true,
      fileId: fauxId,
      nom: nomFichier,
      webViewLink: `https://docs.google.com/document/d/${fauxId}/edit?usp=sharing`
    };
  }

  const drive = configDrive.drive;

  try {
    // 1. Conversion du Buffer mémoire en Stream lisible (RAM pure, sans écriture disque)
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    // 2. Métadonnées du fichier
    const fileMetadata = {
      name: nomFichier,
      parents: folderIdCible ? [folderIdCible] : []
    };

    const media = {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      body: bufferStream
    };

    console.log(`[GoogleDriveService] Téléversement de "${nomFichier}" vers Google Drive (${configDrive.mode})...`);

    // 3. Création du fichier sur Google Drive
    const uploadRes = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink'
    });

    const fileId = uploadRes.data.id;
    const webViewLinkInitial = uploadRes.data.webViewLink;

    // 4. Configuration des permissions de partage pour ouverture dans Google Docs
    try {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'writer', // Permet l'édition collaborative
          type: 'anyone'  // Accessible via le lien de partage généré
        }
      });
    } catch (permErr) {
      console.warn('[GoogleDriveService] Avertissement permissions de partage :', permErr.message);
    }

    // 5. Récupération du lien d'édition final
    const getRes = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, webViewLink'
    });

    const lienFinal = getRes.data.webViewLink || webViewLinkInitial;
    console.log(`[GoogleDriveService] Document téléversé avec succès ! Lien : ${lienFinal}`);

    return {
      succes: true,
      fileId: fileId,
      nom: getRes.data.name,
      webViewLink: lienFinal
    };

  } catch (error) {
    if (error.message && error.message.includes('storage quota')) {
      console.error('[GoogleDriveService] Quota insuffisant : le Compte de Service possède 0 Go alloué par Google sur compte perso.');
      console.error('[GoogleDriveService] Pour un compte personnel @gmail.com, lancez : node scripts/connecter-drive.js');
    }
    console.error('[GoogleDriveService] Erreur lors du téléversement Google Drive :', error.message);
    throw new Error(`Échec du téléversement Google Drive : ${error.message}`);
  }
}

module.exports = {
  televerserDocumentWord,
  initialiserGoogleDrive
};
