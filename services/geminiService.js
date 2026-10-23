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
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash'
];

const PROMPT_INSTRUCTIONS = `Tu es un consultant senior chargé de produire des comptes rendus de réunion exploitables par un décideur.
Analyse les notes, le document ou l'enregistrement audio fourni (notes brutes, désordonnées, avec fautes ou abréviations) et réponds uniquement avec un objet JSON contenant exactement ces 4 clés :
{
  "client": "Nom de l'organisation ou du client concerné, sans civilité ni titre. Si plusieurs, celui pour qui le travail est réalisé. Si absent : null",
  "date": "Date de la réunion au format YYYY-MM-DD. Utilise la date du jour fournie à la fin de ce message pour compléter une année manquante ou convertir une date relative (hier, jeudi dernier). Si aucune date de réunion n'est identifiable dans le contenu, renvoie null. Ne devine jamais.",
  "synthese": "Synthèse structurée en 5 à 8 lignes, une rubrique par ligne, dans cet ordre : 'Avancement : ...', 'Décisions prises : ...', 'Points en attente : ...', 'Budget et délais : ...', 'Risques : ...', 'Opportunités : ...' (pistes commerciales ou projets futurs évoqués, sans les transformer en actions). Omets une rubrique si le contenu n'en parle pas.",
  "actions": "Une action par ligne, commençant par un tiret, au format : - Action (Responsable : X, Échéance : Y). Écris 'non précisé' quand le responsable ou l'échéance n'est pas indiqué."
}

Règles à respecter :
1. N'invente jamais une information. Si une donnée manque, écris 'non précisé'.
2. Distingue ce qui est décidé de ce qui est seulement envisagé ou demandé : une demande ou une idée n'est pas une décision, et va dans 'Points en attente'.
3. Si une information est corrigée ou contredite dans les notes (par exemple une date), signale l'incertitude au lieu de choisir.
4. Une action = une tâche, avec un seul verbe. Sépare les tâches qui sont regroupées dans une même phrase.
5. Ignore le bruit : remarques personnelles, problèmes techniques de la réunion, commentaires sans conséquence.
6. Réponds en français, avec un ton professionnel et factuel, sans phrase d'introduction.
7. Reste sous 2000 caractères pour la synthèse.
8. Attribue un responsable uniquement si les notes le désignent clairement (nom ou rôle). Si les notes sont écrites à la première personne ('je', 'j'ai', 'penser à'), cette personne est l'auteur des notes : écris 'Auteur des notes'. Quelqu'un qui donne son avis ou son accord sur un sujet n'en est pas responsable pour autant : écris 'non précisé'. Utilise exactement l'expression 'Auteur des notes', sans la reformuler.
9. Ne surestime jamais l'état d'avancement : n'écris 'terminé', 'finalisé' ou 'validé' que si les notes disent clairement que c'est le cas. Sinon, reprends l'état indiqué dans les notes (en cours, avancé à X %, à démarrer).
10. Si une information est présentée comme incertaine dans les notes ('je crois', 'peut-être', 'à confirmer'), conserve cette incertitude dans la synthèse ou dans l'action.
11. Conserve les limites exprimées dans les notes (budget maximum, date butoir, seuil au-delà duquel un problème apparaît).
12. Quand la date de la réunion est connue, convertis les échéances relatives (demain, lundi, vendredi, mardi prochain, la semaine prochaine) en dates complètes calculées à partir de la date de la réunion, par exemple 'lundi 19 octobre 2026'. Ne les calcule jamais à partir de la date du jour. Si la date de la réunion est inconnue, garde l'expression d'origine.
13. Conserve les chiffres comparés dans les notes (devis, tarifs, options chiffrées) : une option chiffrée ne doit pas disparaître de la synthèse. Si un point d'agenda est incertain (prochaine réunion, date non confirmée), il doit apparaître dans 'Points en attente'.
14. Si un élément est présenté comme décidé mais que les notes expriment un doute sur sa condition, indique cette condition à côté de la décision.
15. Ne convertis pas en date précise une échéance vague (fin du mois, début novembre, prochainement) : garde l'expression d'origine en ajoutant l'année et le mois si nécessaire, par exemple 'fin octobre 2026'.
16. Ne crée une action que si les notes la demandent ou l'assignent explicitement. Un simple constat (par exemple 'pas encore cherché') va dans 'Points en attente', pas dans les actions.`;
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
      cleanup: async () => { } // Aucun nettoyage requis
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
    } catch { }
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
  const dateJour = new Date().toLocaleDateString('en-CA', { timeZone: 'Indian/Antananarivo' });
  let texteContexte = PROMPT_INSTRUCTIONS + `\n\nDate du jour de traitement : ${dateJour}. Elle sert uniquement à compléter l'année d'une date de réunion incomplète ou à convertir 'hier' ou 'jeudi dernier'. Ne l'utilise jamais pour calculer les échéances des actions.`;

  if (texteBrut && texteBrut.trim()) {
    texteContexte += `\n\nNotes ou consignes complémentaires :\n${texteBrut.trim()}`;
  }

  // 1. Cas sans pièce jointe : analyse textuelle classique
  if (!fichier) {
    return {
      parts: [{ text: texteContexte }],
      cleanup: async () => { }
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
      cleanup: async () => { }
    };
  }

  // 5. Cas Texte brut .txt
  if (extension === '.txt' || mimeType === 'text/plain') {
    const texteFichier = fichier.buffer.toString('utf-8');
    texteContexte += `\n\nContenu du document texte "${fichier.originalname}" :\n${texteFichier}`;
    return {
      parts: [{ text: texteContexte }],
      cleanup: async () => { }
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

        const resultat = JSON.parse(response.text);

        // Validation stricte et normalisation de la date retournée par Gemini
        if (resultat && typeof resultat === 'object') {
          const dateStr = resultat.date ? String(resultat.date).trim() : null;
          resultat.date = (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) ? dateStr : null;
        }

        return resultat;
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
