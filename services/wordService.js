const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  TabStopType,
  TabStopPosition
} = require('docx');

/**
 * Charte Graphique Officielle : Rose Pastel & Rose Blush
 * Couleurs hexadécimales standardisées (sans le préfixe '#' pour la librairie docx).
 */
const PALETTE = {
  BLUSH_PRINCIPAL: 'C97A7E',   // Rose blush raffiné (titres, accentuations)
  BLUSH_FONCE: '9C5559',       // Rose blush profond (en-têtes de section et de tableau)
  PASTEL_FOND: 'FDF6F6',       // Rose pastel très doux (arrière-plan d'encadré)
  PASTEL_BORDURE: 'ECCECE',    // Bordure rose poudré subtile
  TEXTE_PRINCIPAL: '23272F',   // Gris ardoise foncé (lecture confortable)
  TEXTE_SECONDAIRE: '6B7280',  // Gris neutre moyen (métadonnées)
  BLANC: 'FFFFFF'
};

// Largeur utile d'une page A4 avec des marges de 2,54 cm (en DXA : 1440 = 1 pouce)
const LARGEUR_PAGE = 9026;

// Rubriques attendues dans la clé "synthese" (doivent correspondre au prompt)
const RUBRIQUES = [
  'Avancement',
  'Décisions prises',
  'Points en attente',
  'Budget et délais',
  'Risques',
  'Opportunités'
];

const TRAIT_FIN = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: PALETTE.PASTEL_BORDURE
};

const BORDURES_FINES = {
  top: TRAIT_FIN,
  bottom: TRAIT_FIN,
  left: TRAIT_FIN,
  right: TRAIT_FIN
};

/**
 * Formate une date en français (ex : 21 octobre 2026).
 *
 * @param {Date} [date] Date à formater (par défaut date du jour).
 * @returns {string} Date lisible en français.
 */
function formaterDateFr(date = new Date()) {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Convertit une chaîne YYYY-MM-DD en Date locale, sans décalage de fuseau horaire.
 *
 * @param {string} texte Date au format YYYY-MM-DD.
 * @returns {Date|null} Date valide, ou null si le format est incorrect.
 */
function lireDateIso(texte) {
  if (!texte || !/^\d{4}-\d{2}-\d{2}$/.test(String(texte).trim())) {
    return null;
  }
  const [annee, mois, jour] = String(texte).trim().split('-').map(Number);
  const date = new Date(annee, mois - 1, jour);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Découpe la synthèse en rubriques (Avancement, Décisions prises, etc.).
 * Si le texte ne contient aucune rubrique reconnue, il est renvoyé tel quel.
 *
 * @param {string} texte Synthèse brute renvoyée par l'IA.
 * @returns {{rubrique: (string|null), texte: string}[]} Liste de blocs.
 */
function extraireRubriques(texte) {
  if (!texte || typeof texte !== 'string') {
    return [];
  }

  const motif = new RegExp(`(?=(?:${RUBRIQUES.join('|')})\\s*:)`);

  return texte
    .split(motif)
    .map(bloc => bloc.trim())
    .filter(Boolean)
    .map(bloc => {
      const position = bloc.indexOf(':');
      const rubrique = position === -1 ? '' : bloc.slice(0, position).trim();
      if (!RUBRIQUES.includes(rubrique)) {
        return { rubrique: null, texte: bloc };
      }
      return { rubrique, texte: bloc.slice(position + 1).trim() };
    });
}

/**
 * Découpe la chaîne d'actions en objets {action, responsable, echeance}.
 * Format attendu par ligne : "- Action (Responsable : X, Échéance : Y)".
 * Une ligne qui ne respecte pas ce format est conservée, avec "non précisé".
 *
 * @param {string} actionsTexte Texte brut des actions (une par ligne).
 * @returns {{action: string, responsable: string, echeance: string}[]} Liste d'actions.
 */
function extraireActions(actionsTexte) {
  if (!actionsTexte || typeof actionsTexte !== 'string') {
    return [];
  }

  return actionsTexte
    .split('\n')
    .map(ligne => ligne.trim())
    .filter(Boolean)
    .map(ligne => ligne.replace(/^[-*•◆]\s*/, '').replace(/^\d+[.)]\s+/, '').trim())
    .filter(Boolean)
    .map(ligne => {
      const trouve = ligne.match(
        /^(.*?)\s*\(\s*Responsable\s*:\s*(.*?)\s*,\s*[eé]ch[eé]ance\s*:\s*(.*?)\s*\)\s*\.?$/i
      );
      if (!trouve) {
        return { action: ligne, responsable: 'non précisé', echeance: 'non précisé' };
      }
      return {
        action: trouve[1].trim(),
        responsable: trouve[2].trim() || 'non précisé',
        echeance: trouve[3].trim() || 'non précisé'
      };
    });
}

/**
 * Crée une cellule de tableau avec texte, bordures fines et largeur DXA.
 * Les mentions "non précisé" sont affichées en gris italique.
 *
 * @param {string} texte Contenu de la cellule.
 * @param {Object} options Options de mise en forme.
 * @param {number} options.largeur Largeur de la colonne en DXA.
 * @param {boolean} [options.gras] Texte en gras.
 * @param {string} [options.couleur] Couleur du texte.
 * @param {string} [options.fond] Couleur de fond.
 * @param {boolean} [options.italique] Texte en italique.
 * @returns {TableCell} Cellule prête à être ajoutée à une ligne.
 */
function creerCellule(texte, options) {
  const { largeur, gras = false, couleur = PALETTE.TEXTE_PRINCIPAL, fond = null, italique = false } = options;
  const nonPrecise = /^non précis/i.test(texte);

  return new TableCell({
    width: { size: largeur, type: WidthType.DXA },
    borders: BORDURES_FINES,
    shading: fond ? { type: ShadingType.CLEAR, fill: fond, color: 'auto' } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: texte,
            font: 'Arial',
            size: 20,
            bold: gras,
            italics: italique || nonPrecise,
            color: nonPrecise ? PALETTE.TEXTE_SECONDAIRE : couleur
          })
        ]
      })
    ]
  });
}

/**
 * Crée une ligne de la fiche d'identité (libellé à gauche, valeur à droite).
 *
 * @param {string} libelle Intitulé de la ligne.
 * @param {string} valeur Valeur affichée.
 * @param {Object} [options] Mise en forme de la valeur.
 * @param {boolean} [options.accent] Valeur en gras, couleur blush.
 * @param {boolean} [options.discret] Valeur en gris italique (information manquante).
 * @returns {TableRow} Ligne du tableau.
 */
function creerLigneMeta(libelle, valeur, options = {}) {
  const { accent = false, discret = false } = options;
  const largeurLibelle = 2600;
  const largeurValeur = LARGEUR_PAGE - largeurLibelle;

  return new TableRow({
    children: [
      new TableCell({
        width: { size: largeurLibelle, type: WidthType.DXA },
        borders: BORDURES_FINES,
        shading: { type: ShadingType.CLEAR, fill: PALETTE.PASTEL_FOND, color: 'auto' },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: libelle,
                font: 'Arial',
                size: 20,
                color: PALETTE.TEXTE_SECONDAIRE
              })
            ]
          })
        ]
      }),
      new TableCell({
        width: { size: largeurValeur, type: WidthType.DXA },
        borders: BORDURES_FINES,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: valeur,
                font: 'Arial',
                size: 21,
                bold: accent,
                italics: discret,
                color: accent
                  ? PALETTE.BLUSH_PRINCIPAL
                  : discret
                    ? PALETTE.TEXTE_SECONDAIRE
                    : PALETTE.TEXTE_PRINCIPAL
              })
            ]
          })
        ]
      })
    ]
  });
}

/**
 * Crée un titre de section (1. Synthèse exécutive, 2. Plan d'action).
 *
 * @param {string} texte Titre de la section.
 * @param {number} avant Espacement avant le titre (en twips).
 * @returns {Paragraph} Paragraphe de titre.
 */
function creerTitreSection(texte, avant) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: avant, after: 160 },
    children: [
      new TextRun({
        text: texte,
        font: 'Arial',
        size: 26,
        bold: true,
        color: PALETTE.BLUSH_FONCE
      })
    ]
  });
}

/**
 * Génère un document Word (.docx) professionnel en mémoire vive (Buffer)
 * à partir du JSON structuré de synthèse (Google Gemini).
 *
 * @param {Object} donnees Données issues de l'analyse IA.
 * @param {string} [donnees.client] Nom du client ou intitulé du projet.
 * @param {string} [donnees.date] Date de la réunion au format YYYY-MM-DD, ou null.
 * @param {string} [donnees.synthese] Synthèse structurée par rubriques.
 * @param {string} [donnees.actions] Une action par ligne, avec responsable et échéance.
 * @param {Object} [options] Métadonnées optionnelles.
 * @param {string} [options.auteur] Nom du rédacteur ou de l'application.
 * @returns {Promise<Buffer>} Buffer binaire du fichier Word (.docx).
 */
async function genererDocumentWord(donnees = {}, options = {}) {
  const nomClient = (donnees.client || 'Client non spécifié').trim();
  const rubriques = extraireRubriques(donnees.synthese);
  const actions = extraireActions(donnees.actions);

  // Deux dates distinctes : la réunion (jamais remplacée par la date du jour) et la rédaction
  const dateReunionBrute = lireDateIso(donnees.date);
  const dateReunion = dateReunionBrute ? formaterDateFr(dateReunionBrute) : 'Non précisée';
  const dateRedaction = formaterDateFr();

  // 1. En-tête de page (discret et professionnel sur chaque page)
  const headerPage = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: 'REPORTFLOW',
            font: 'Arial',
            size: 16,
            bold: true,
            color: PALETTE.BLUSH_PRINCIPAL
          }),
          new TextRun({
            text: `  |  Compte-rendu de réunion, ${nomClient}`,
            font: 'Arial',
            size: 16,
            color: PALETTE.TEXTE_SECONDAIRE
          })
        ]
      })
    ]
  });

  // 2. Pied de page : mention à gauche, numérotation alignée à droite grâce à une tabulation
  const footerPage = new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({
            text: 'Généré automatiquement par ReportFlow. À relire avant diffusion.',
            font: 'Arial',
            size: 16,
            italics: true,
            color: PALETTE.TEXTE_SECONDAIRE
          }),
          new TextRun({ text: '\tPage ', font: 'Arial', size: 16, color: PALETTE.TEXTE_SECONDAIRE }),
          new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: PALETTE.TEXTE_SECONDAIRE }),
          new TextRun({ text: ' sur ', font: 'Arial', size: 16, color: PALETTE.TEXTE_SECONDAIRE }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 16, color: PALETTE.TEXTE_SECONDAIRE })
        ]
      })
    ]
  });

  // 3. Fiche d'identité de la réunion
  const tableauMeta = new Table({
    width: { size: LARGEUR_PAGE, type: WidthType.DXA },
    columnWidths: [2600, LARGEUR_PAGE - 2600],
    rows: [
      creerLigneMeta('Client / Projet', nomClient, { accent: true }),
      creerLigneMeta('Date de la réunion', dateReunion, { discret: !dateReunionBrute }),
      creerLigneMeta('Date de rédaction', dateRedaction),
      creerLigneMeta('Statut', 'Brouillon, à valider')
    ]
  });

  // 4. Synthèse : un paragraphe par rubrique, nom de la rubrique en gras
  const paragraphesSynthese = [];
  if (rubriques.length === 0) {
    paragraphesSynthese.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Aucune synthèse disponible pour cette séance.',
            font: 'Arial',
            size: 21,
            italics: true,
            color: PALETTE.TEXTE_SECONDAIRE
          })
        ]
      })
    );
  } else {
    rubriques.forEach(({ rubrique, texte }, index) => {
      const enfants = [];
      if (rubrique) {
        enfants.push(
          new TextRun({
            text: `${rubrique} : `,
            font: 'Arial',
            size: 21,
            bold: true,
            color: PALETTE.BLUSH_FONCE
          })
        );
      }
      enfants.push(
        new TextRun({
          text: texte,
          font: 'Arial',
          size: 21,
          color: PALETTE.TEXTE_PRINCIPAL
        })
      );
      paragraphesSynthese.push(
        new Paragraph({
          spacing: { line: 300, after: index === rubriques.length - 1 ? 0 : 140 },
          children: enfants
        })
      );
    });
  }

  const tableauSynthese = new Table({
    width: { size: LARGEUR_PAGE, type: WidthType.DXA },
    columnWidths: [LARGEUR_PAGE],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: LARGEUR_PAGE, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: PALETTE.BLANC },
              bottom: { style: BorderStyle.NONE, size: 0, color: PALETTE.BLANC },
              right: { style: BorderStyle.NONE, size: 0, color: PALETTE.BLANC },
              left: { style: BorderStyle.SINGLE, size: 24, color: PALETTE.BLUSH_PRINCIPAL }
            },
            shading: { type: ShadingType.CLEAR, fill: PALETTE.PASTEL_FOND, color: 'auto' },
            margins: { top: 200, bottom: 200, left: 260, right: 200 },
            children: paragraphesSynthese
          })
        ]
      })
    ]
  });

  // 5. Plan d'action : tableau Action / Responsable / Échéance
  const largeurs = [5000, 2200, LARGEUR_PAGE - 7200];

  let blocActions;
  if (actions.length === 0) {
    blocActions = new Paragraph({
      children: [
        new TextRun({
          text: 'Aucune action immédiate identifiée lors de cette séance.',
          font: 'Arial',
          size: 20,
          italics: true,
          color: PALETTE.TEXTE_SECONDAIRE
        })
      ]
    });
  } else {
    const enteteStyle = { gras: true, couleur: PALETTE.BLANC, fond: PALETTE.BLUSH_FONCE };
    blocActions = new Table({
      width: { size: LARGEUR_PAGE, type: WidthType.DXA },
      columnWidths: largeurs,
      rows: [
        new TableRow({
          tableHeader: true,
          cantSplit: true,
          children: [
            creerCellule('Action', { largeur: largeurs[0], ...enteteStyle }),
            creerCellule('Responsable', { largeur: largeurs[1], ...enteteStyle }),
            creerCellule('Échéance', { largeur: largeurs[2], ...enteteStyle })
          ]
        }),
        ...actions.map(
          ({ action, responsable, echeance }) =>
            new TableRow({
              cantSplit: true,
              children: [
                creerCellule(action, { largeur: largeurs[0] }),
                creerCellule(responsable, { largeur: largeurs[1] }),
                creerCellule(echeance, { largeur: largeurs[2] })
              ]
            })
        )
      ]
    });
  }

  const notePlanAction = new Paragraph({
    spacing: { before: 120 },
    children: [
      new TextRun({
        text: 'Les mentions « non précisé » sont à compléter lors de la validation du compte-rendu.',
        font: 'Arial',
        size: 16,
        italics: true,
        color: PALETTE.TEXTE_SECONDAIRE
      })
    ]
  });

  // 6. Assemblage complet du document
  const doc = new Document({
    creator: options.auteur || 'ReportFlow',
    title: `Compte-rendu - ${nomClient}`,
    description: `Compte-rendu de réunion généré automatiquement pour ${nomClient}`,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440
            }
          }
        },
        headers: { default: headerPage },
        footers: { default: footerPage },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 120 },
            children: [
              new TextRun({
                text: 'Compte-Rendu de Réunion',
                font: 'Arial',
                size: 38,
                bold: true,
                color: PALETTE.BLUSH_FONCE
              })
            ]
          }),
          new Paragraph({
            spacing: { after: 280 },
            children: [
              new TextRun({
                text: "Synthèse exécutive & Plan d'action opérationnel",
                font: 'Arial',
                size: 22,
                color: PALETTE.TEXTE_SECONDAIRE
              })
            ]
          }),

          tableauMeta,

          creerTitreSection('1. Synthèse exécutive', 400),
          tableauSynthese,

          creerTitreSection("2. Plan d'action opérationnel", 400),
          blocActions,
          ...(actions.length > 0 ? [notePlanAction] : [])
        ]
      }
    ]
  });

  // 7. Sérialisation en mémoire vive sous forme de Buffer
  return await Packer.toBuffer(doc);
}

module.exports = {
  genererDocumentWord,
  PALETTE
};