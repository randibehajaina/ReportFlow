const { GoogleGenAI } = require('@google/genai');
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');
const os = require('os');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('[GeminiService] Attention : GEMINI_API_KEY est manquante dans le fichier .env.');
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Seuil en octets (20 Mo) délimitant la stratégie de transmission vers Google Gemini :
 * - En dessous de 20 Mo : transmission directe en mémoire vive via base64 inlineData (ultra-rapide, 0 I/O disque).
 * - Au-delà de 20 Mo (ex: enregistrement audio de réunion de 2h, pesant 40 à 150 Mo) : téléversement
 *   vers l'API Files officielle de Google pour contourner le plafond HTTP payload de 20 Mo.
 */
const SEUIL_TAILLE_UPLOAD_FICHIER = 20 * 1024 * 1024; // 20 Mo

/**
 * Modèles sollicités par ordre de priorité.
 * Chaîne de secours : si un modèle est surchargé (503), l'appel bascule immédiatement sur le suivant.
 */
const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-3.8-flash'
];

const PROMPT_INSTRUCTIONS = `Tu es un consultant senior chez ReportFlow.
Analyse les notes, le document ou l'enregistrement audio de réunion fourni et extrais les informations dans un objet JSON avec exactement ces 4 clés :
{
  "client": "Nom de l'entreprise ou du client",
  "date": "Date de la réunion au format YYYY-MM-DD si mentionnée explicitement dans le contenu, sinon null",
  "synthese": "Résumé professionnel en 2 phrases maximum",
  "actions": "Liste des actions à faire (avec des tirets)"
}`;

/**
 * Détermine le type MIME audio standard attendu par Google Gemini.
 * Résout les disparités entre navigateurs (ex: Safari qui envoie audio/x-m4a pour un fichier .m4a).
 *
 * @param {string} extension Extension du fichier (ex: .mp3, .m4a).
 * @param {string} mimeTypeClient Type MIME brut envoyé par le navigateur.
 * @returns {string} Type MIME normalisé (ex: audio/mp3, audio/m4a).
 */
function normaliserMimeTypeAudio(extension, mimeTypeClient) {
  const tableMime = {
    '.mp3': 'audio/mp3',
    '.m4a': 'audio/m4a',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.webm': 'audio/webm'
  };

  return tableMime[extension] || (mimeTypeClient && mimeTypeClient.startsWith('audio/') ? mimeTypeClient : 'audio/mp3');
}

/**
 * Prépare la Part pour un fichier binaire (audio ou PDF).
 * Si le fichier est < 20 Mo : encodage direct en mémoire via inlineData (rapide, sans I/O disque).
 * Si le fichier est >= 20 Mo (ex: enregistrement audio de 2h) : téléversement vers l'API Google Files
 * via un fichier temporaire sur disque, puis génération d'une référence fileData.
 *
 * @param {Object} params
 * @param {Buffer} params.buffer Contenu binaire du fichier en mémoire RAM.
 * @param {string} params.mimeType Type MIME normalisé (ex: audio/mp3, application/pdf).
 * @param {string} params.originalname Nom d'origine du fichier.
 * @param {number} params.size Taille en octets du fichier.
 * @returns {Promise<{ part: Object, cleanup: Function }>}
 */
async function creerPartFichier({ buffer, mimeType, originalname, size }) {
  // Cas 1 : Fichier sous le seuil de 20 Mo -> Transmission directe en base64 (RAM pure)
  if (size < SEUIL_TAILLE_UPLOAD_FICHIER) {
    return {
      part: {
        inlineData: {
          mimeType,
          data: buffer.toString('base64')
        }
      },
      cleanup: async () => {} // Aucun nettoyage requis
    };
  }

  // Cas 2 : Fichier volumineux (>= 20 Mo, ex: réunion audio de 2h) -> Google Files API
  console.log(`[GeminiService] Fichier volumineux détecté (${(size / (1024 * 1024)).toFixed(1)} Mo). Passage par l'API Google Files...`);

  const ext = path.extname(originalname || '') || '.tmp';
  const nomFichierTemp = `reportflow-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
  const cheminTemp = path.join(os.tmpdir(), nomFichierTemp);

  let uploadedFile = null;

  try {
    // Écriture temporaire sur disque pour permettre l'upload via stream/fichier du SDK
    await fs.promises.writeFile(cheminTemp, buffer);

    uploadedFile = await ai.files.upload({
      file: cheminTemp,
      config: {
        mimeType,
        displayName: originalname || 'fichier-reportflow'
      }
    });

    console.log(`[GeminiService] Téléversement réussi vers Google Files (Ressource : ${uploadedFile.name}).`);

    // Vérification du statut de traitement si nécessaire (pour les fichiers lourds)
    let fichierGoogle = uploadedFile;
    let tentatives = 0;
    while (fichierGoogle.state === 'PROCESSING' && tentatives < 30) {
      tentatives++;
      console.log(`[GeminiService] Traitement en cours chez Google... (tentative ${tentatives})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      fichierGoogle = await ai.files.get({ name: uploadedFile.name });
    }

    if (fichierGoogle.state === 'FAILED') {
      throw new Error(`Le traitement du fichier par Google a échoué (${fichierGoogle.error?.message || 'state FAILED'}).`);
    }

    const part = {
      fileData: {
        fileUri: fichierGoogle.uri,
        mimeType: fichierGoogle.mimeType || mimeType
      }
    };

    const cleanup = async () => {
      // 1. Nettoyage du fichier temporaire local sur le disque du serveur
      try {
        if (fs.existsSync(cheminTemp)) {
          await fs.promises.unlink(cheminTemp);
        }
      } catch (errLocal) {
        console.warn(`[GeminiService] Avertissement suppression locale (${cheminTemp}) :`, errLocal.message);
      }

      // 2. Nettoyage de la ressource distante sur Google Files pour respecter la confidentialité et préserver le quota
      try {
        if (uploadedFile && uploadedFile.name) {
          await ai.files.delete({ name: uploadedFile.name });
          console.log(`[GeminiService] Fichier distant nettoyé (${uploadedFile.name}).`);
        }
      } catch (errDistant) {
        console.warn(`[GeminiService] Avertissement suppression distante (${uploadedFile?.name}) :`, errDistant.message);
      }
    };

    return { part, cleanup };

  } catch (error) {
    // En cas d'échec durant la phase d'upload, supprimer immédiatement le fichier temporaire local
    try {
      if (fs.existsSync(cheminTemp)) {
        await fs.promises.unlink(cheminTemp);
      }
    } catch {}
    throw error;
  }
}

/**
 * Prépare les parties (parts) du message multimodal pour l'API Gemini.
 * Assemble le texte de consigne et les données (documents ou pistes audio) selon la stratégie optimale.
 *
 * @param {Object} params
 * @param {string} [params.texteBrut] Notes saisies au clavier ou consignes additionnelles.
 * @param {Object} [params.fichier] Objet fichier Multer (buffer, mimetype, originalname, size).
 * @returns {Promise<{ parts: Array, cleanup: Function }>} Tableau de parties prêtes pour generateContent et fonction de nettoyage.
 */
async function preparerRequeteGemini({ texteBrut, fichier }) {
  let texteContexte = PROMPT_INSTRUCTIONS;

  if (texteBrut && texteBrut.trim()) {
    texteContexte += `\n\nNotes ou consignes complémentaires :\n${texteBrut.trim()}`;
  }

  // 1. Cas sans pièce jointe : analyse textuelle classique
  if (!fichier) {
    return {
      parts: [{ text: texteContexte }],
      cleanup: async () => {}
    };
  }

  const extension = path.extname(fichier.originalname || '').toLowerCase();
  const mimeType = fichier.mimetype || '';

  // 2. Cas Audio : enregistrements vocaux, dictaphones, réunions enregistrées (.mp3, .m4a, .wav...)
  const extensionsAudio = ['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.flac', '.webm'];
  if (extensionsAudio.includes(extension) || mimeType.startsWith('audio/')) {
    const typeAudio = normaliserMimeTypeAudio(extension, mimeType);
    texteContexte += `\n\nVeuillez écouter attentivement l'enregistrement audio joint "${fichier.originalname}" et en extraire la synthèse :`;

    const { part, cleanup } = await creerPartFichier({
      buffer: fichier.buffer,
      mimeType: typeAudio,
      originalname: fichier.originalname,
      size: fichier.size
    });

    return {
      parts: [
        { text: texteContexte },
        part
      ],
      cleanup
    };
  }

  // 3. Cas PDF : lecture multimodale directe du document vectoriel
  if (mimeType === 'application/pdf' || extension === '.pdf') {
    texteContexte += `\n\nVeuillez analyser le document PDF joint "${fichier.originalname}" :`;

    const { part, cleanup } = await creerPartFichier({
      buffer: fichier.buffer,
      mimeType: 'application/pdf',
      originalname: fichier.originalname,
      size: fichier.size
    });

    return {
      parts: [
        { text: texteContexte },
        part
      ],
      cleanup
    };
  }

  // 4. Cas Word .docx : extraction préalable du texte via Mammoth (toujours léger en mémoire)
  if (extension === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const resultatExtraction = await mammoth.extractRawText({ buffer: fichier.buffer });
    const texteDocument = resultatExtraction.value || '';

    texteContexte += `\n\nContenu extrait du document Word "${fichier.originalname}" :\n${texteDocument}`;
    return {
      parts: [{ text: texteContexte }],
      cleanup: async () => {}
    };
  }

  // 5. Cas Texte brut .txt
  if (extension === '.txt' || mimeType === 'text/plain') {
    const texteFichier = fichier.buffer.toString('utf-8');
    texteContexte += `\n\nContenu du document texte "${fichier.originalname}" :\n${texteFichier}`;
    return {
      parts: [{ text: texteContexte }],
      cleanup: async () => {}
    };
  }

  throw new Error(`Format de fichier non pris en charge : ${extension || mimeType}`);
}

/**
 * Analyse tout type de contenu (texte, PDF, Word, ou audio jusqu'à 2h) et renvoie le JSON validé.
 * Gère la chaîne de fallback résiliente et garantit le nettoyage des ressources temporaires.
 *
 * @param {Object} options
 * @param {string} [options.texteBrut] Texte brut de réunion.
 * @param {Object} [options.fichier] Fichier uploadé en mémoire.
 * @returns {Promise<{client: string, synthese: string, actions: string}>} Données structurées.
 */
async function analyserContenu({ texteBrut, fichier }) {
  if ((!texteBrut || !texteBrut.trim()) && !fichier) {
    throw new Error('Veuillez fournir du texte ou joindre un fichier (document ou audio) à analyser.');
  }

  const { parts, cleanup } = await preparerRequeteGemini({ texteBrut, fichier });
  let lastError = null;

  try {
    for (const model of FALLBACK_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts
            }
          ],
          config: {
            responseMimeType: 'application/json'
          }
        });

        return JSON.parse(response.text);
      } catch (err) {
        console.warn(`[GeminiService] Modèle ${model} indisponible (${err.message}). Tentative sur le modèle suivant...`);
        lastError = err;
      }
    }

    throw new Error(`Échec de l'analyse IA sur tous les modèles : ${lastError?.message || 'Erreur inconnue'}`);
  } finally {
    if (typeof cleanup === 'function') {
      await cleanup();
    }
  }
}

module.exports = {
  analyserContenu,
  analyserCompteRendu: (texte) => analyserContenu({ texteBrut: texte })
};
