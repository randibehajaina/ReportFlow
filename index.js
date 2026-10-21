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

// Configuration de Multer : stockage sécurisé en mémoire vive (zéro trace sur disque par défaut)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024 // 200 Mo (adapté pour les réunions audio allant jusqu'à 2h en MP3/M4A)
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const formatsAcceptes = [
      '.pdf', '.docx', '.txt',           // Documents
      '.mp3', '.m4a', '.wav', '.aac',    // Formats audio courants & mémos vocaux
      '.ogg', '.flac', '.webm'
    ];

    if (formatsAcceptes.includes(ext) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Formats acceptés : PDF, Word (.docx), Texte (.txt) ou Audio (.mp3, .m4a, .wav).'));
    }
  }
});

// Vue principale avec injection des URLs directes Cloud
app.get('/', (req, res) => {
  const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
  const databaseId = process.env.DATABASE_ID || null;

  const driveUrl = driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : null;
  const notionUrl = databaseId ? `https://notion.so/${databaseId.replace(/-/g, '')}` : null;

  res.render('index', {
    driveUrl,
    notionUrl
  });
});

// Pipeline d'automatisation : support du texte brut, de documents et de pistes audio (jusqu'à 2h)
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
  const notesBrutes = req.body?.notesBrutes || '';
  const fichier = req.file || null;

  if (!notesBrutes.trim() && !fichier) {
    return res.status(400).json({
      succes: false,
      erreur: 'Veuillez saisir des notes ou déposer un document à analyser.'
    });
  }

  try {
    // 1. Analyse multimodale (texte et/ou fichier)
    const donneesStructurees = await analyserContenu({
      texteBrut: notesBrutes,
      fichier
    });

    // 2. Génération du rapport Word (.docx) officiel en mémoire vive
    let lienDrive = null;
    try {
      const bufferWord = await genererDocumentWord(donneesStructurees);

      const slugClient = (donneesStructurees.client || 'Projet')
        .trim()
        .replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 40);

      const dateFichier = donneesStructurees.date || new Date().toISOString().split('T')[0];
      const nomFichier = `Compte-rendu-${slugClient}-${dateFichier}.docx`;

      // 3. Téléversement Cloud vers Google Drive via Compte de Service
      const driveRes = await televerserDocumentWord({
        nomFichier,
        buffer: bufferWord
      });

      lienDrive = driveRes?.webViewLink || null;
    } catch (errDrive) {
      console.warn('[Server] Note téléversement Google Drive :', errDrive.message);
    }

    // 4. Persistance automatique dans Notion (avec la Date et le lien Google Drive)
    const notionPageId = await insererCompteRendu({
      ...donneesStructurees,
      lienDrive
    });

    return res.status(200).json({
      succes: true,
      notionId: notionPageId,
      donnees: donneesStructurees,
      lienDrive,
      source: fichier ? { nom: fichier.originalname, taille: fichier.size } : null
    });
  } catch (err) {
    console.error('[API /api/analyser]', err.message);

    return res.status(500).json({
      succes: false,
      erreur: err.message || 'Une erreur interne est survenue durant le traitement.',
      notionDetails: err.details || null
    });
  }
});

// Route de génération et de téléchargement du rapport Word officiel (.docx)
app.post('/api/generer-word', async (req, res) => {
  const { client, date, synthese, actions } = req.body || {};

  if (!client && !synthese && !actions) {
    return res.status(400).json({
      succes: false,
      erreur: 'Données insuffisantes pour générer le document Word.'
    });
  }

  try {
    const bufferWord = await genererDocumentWord({
      client: client || 'Projet',
      date: date || null,
      synthese: synthese || '',
      actions: actions || ''
    });

    // Formatage d'un nom de fichier propre et sécurisé
    const slugClient = (client || 'Projet')
      .trim()
      .replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 40);

    const dateAujourdhui = new Date().toISOString().split('T')[0];
    const nomFichier = `Compte-rendu-${slugClient}-${dateAujourdhui}.docx`;

    // En-têtes HTTP pour déclencher le téléchargement binaire dans le navigateur
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