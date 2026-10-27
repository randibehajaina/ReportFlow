require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');

const { analyserContenu } = require('./services/geminiService');
const { insererCompteRendu } = require('./services/notionService');
const { genererDocumentWord } = require('./services/wordService');
const { televerserDocumentWord } = require('./services/googleDriveService');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration du moteur de rendu
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares standards pour le texte et formulaires
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuration de Multer : stockage en mémoire vive (MemoryStorage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024 // 200 Mo
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const formatsAcceptes = [
      '.pdf', '.docx', '.txt',           // Documents textuels
      '.mp3', '.m4a', '.wav', '.aac',    // Formats audio
      '.ogg', '.flac', '.webm'
    ];

    if (formatsAcceptes.includes(ext) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Formats acceptés : PDF, Word (.docx), Texte (.txt) ou Audio (.mp3, .m4a, .wav).'));
    }
  }
});

// Route principale : affichage de l'interface utilisateur
app.get('/', (req, res) => {
  const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
  const defaultDriveUrl = 'https://drive.google.com/drive/folders/1E0JuMIXHv3cTl3GsP-Tl5ilqp5C1iX7Z?usp=drive_link';
  const driveUrl = process.env.GOOGLE_DRIVE_FOLDER_URL || (driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}?usp=drive_link` : defaultDriveUrl);
  const notionUrl = process.env.NOTION_HOME_URL || 'https://app.notion.com/p/Accueil-4026955c3b6480b097e9fdc8171e8edf?pvs=12';

  res.render('index', {
    driveUrl,
    notionUrl
  });
});

// Route de traitement : extraction, synthèse, génération documentaire et synchronisation
app.post('/api/analyser', (req, res, next) => {
  upload.single('document')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          succes: false,
          erreur: 'Le fichier dépasse la taille maximale autorisée (200 Mo / ~2h d\'audio).'
        });
      }
      return res.status(400).json({ succes: false, erreur: err.message });
    } else if (err) {
      return res.status(400).json({ succes: false, erreur: err.message });
    }
    next();
  });
}, async (req, res) => {
  const rawNotes = req.body?.notesBrutes || '';
  const fichier = req.file || null;

  if (!rawNotes.trim() && !fichier) {
    return res.status(400).json({
      succes: false,
      erreur: 'Veuillez saisir des notes ou déposer un document à analyser.'
    });
  }

  // Règle d'exclusivité mutuelle : si un fichier est fourni, le texte est strictement ignoré
  const notesBrutes = fichier ? '' : rawNotes.trim();

  try {
    // 1. Extraction et structuration des données via Gemini
    const donneesStructurees = await analyserContenu({
      texteBrut: notesBrutes,
      fichier
    });

    // 2. Génération du document Word (.docx) en mémoire
    let lienDrive = null;
    try {
      const bufferWord = await genererDocumentWord(donneesStructurees);

      const sujetFichier = (donneesStructurees.titre || donneesStructurees.projet || donneesStructurees.client || 'Compte-rendu')
        .trim()
        .replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 45);

      const matchDate = donneesStructurees.date ? String(donneesStructurees.date).match(/^\d{4}-\d{2}-\d{2}/) : null;
      const dateFichier = matchDate ? matchDate[0] : new Date().toISOString().split('T')[0];
      const nomFichier = `CR-${dateFichier}-${sujetFichier}.docx`;

      // 3. Téléversement vers Google Drive (OAuth 2.0 / Service Account)
      const driveRes = await televerserDocumentWord({
        nomFichier,
        buffer: bufferWord
      });

      lienDrive = driveRes?.webViewLink || null;
    } catch (errDrive) {
      console.warn('[Server] Note téléversement Google Drive :', errDrive.message);
    }

    // 4. Enregistrement dans la base Notion et association Client + Projet
    const notionRes = await insererCompteRendu({
      ...donneesStructurees,
      lienDrive
    });

    const notionPageId = typeof notionRes === 'object' ? notionRes.id : notionRes;

    // Compléter les données si déduites par Notion
    if (typeof notionRes === 'object') {
      if (!donneesStructurees.projet && notionRes.projetNom) {
        donneesStructurees.projet = notionRes.projetNom;
      }
      if (!donneesStructurees.client && notionRes.clientNom) {
        donneesStructurees.client = notionRes.clientNom;
      }
      if (notionRes.titre) {
        donneesStructurees.titre = notionRes.titre;
      }
    }

    return res.status(200).json({
      succes: true,
      notionId: notionPageId,
      projetAssocie: typeof notionRes === 'object' ? notionRes.projetNom : null,
      clientAssocie: typeof notionRes === 'object' ? notionRes.clientNom : null,
      donnees: donneesStructurees,
      lienDrive,
      source: fichier ? { nom: fichier.originalname, taille: fichier.size } : null
    });
  } catch (err) {
    console.error('[API /api/analyser]', err.message);

    let code = 'ERREUR_GENERIQUE';
    const msg = (err.message || '').toLowerCase();

    if (msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota') || msg.includes('rate limit')) {
      code = 'QUOTA_DEPASSE';
    } else if (msg.includes('503') || msg.includes('overloaded') || msg.includes('surchargé')) {
      code = 'SERVEUR_OCCUPE';
    } else if (msg.includes('timeout') || msg.includes('econnaborted') || msg.includes('etimedout') || msg.includes('econnreset') || msg.includes('enotfound')) {
      code = 'TIMEOUT_RESEAU';
    } else if (msg.includes('notion') || err.details) {
      code = 'ERREUR_NOTION';
    } else if (msg.includes('api_key') || msg.includes('permission_denied') || msg.includes('api key')) {
      code = 'ERREUR_AUTHENTIFICATION';
    }

    return res.status(500).json({
      succes: false,
      code,
      erreur: err.message || 'Une erreur interne est survenue durant le traitement.',
      notionDetails: err.details || null
    });
  }
});

// Route d'export : génération et téléchargement direct du fichier Word
app.post('/api/generer-word', async (req, res) => {
  const { titre, client, projet, date, synthese, actions } = req.body || {};

  if (!titre && !client && !projet && !synthese && !actions) {
    return res.status(400).json({
      succes: false,
      erreur: 'Données insuffisantes pour générer le document Word.'
    });
  }

  try {
    const bufferWord = await genererDocumentWord({
      titre: titre || null,
      client: client || 'Client non spécifié',
      projet: projet || null,
      date: date || null,
      synthese: synthese || '',
      actions: actions || ''
    });

    // Normalisation du nom de fichier exporté
    const sujetFichier = (titre || projet || client || 'Compte-rendu')
      .trim()
      .replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 45);

    const matchDateExport = date ? String(date).match(/^\d{4}-\d{2}-\d{2}/) : null;
    const dateFichier = matchDateExport ? matchDateExport[0] : new Date().toISOString().split('T')[0];
    const nomFichier = `CR-${dateFichier}-${sujetFichier}.docx`;

    // En-têtes HTTP pour téléchargement binaire
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"; filename*=UTF-8''${encodeURIComponent(nomFichier)}`);
    res.setHeader('Content-Length', bufferWord.length);

    return res.send(bufferWord);
  } catch (err) {
    console.error('[API /api/generer-word]', err.message);
    return res.status(500).json({
      succes: false,
      erreur: 'Impossible de générer le fichier Word : ' + err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`[Server] ReportFlow actif sur http://localhost:${PORT}`);
});