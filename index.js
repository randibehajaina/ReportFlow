require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');

const { analyserContenu } = require('./services/geminiService');
const { insererCompteRendu } = require('./services/notionService');

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

// Vue principale
app.get('/', (req, res) => {
  res.render('index');
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

    // 2. Persistance automatique dans la base Notion
    const notionPageId = await insererCompteRendu(donneesStructurees);

    return res.status(200).json({
      succes: true,
      notionId: notionPageId,
      donnees: donneesStructurees,
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

app.listen(PORT, () => {
  console.log(`[Server] ReportFlow actif sur http://localhost:${PORT}`);
});