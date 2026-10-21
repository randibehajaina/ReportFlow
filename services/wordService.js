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
  PageNumber
} = require('docx');

/**
 * Charte Graphique Officielle : Rose Pastel & Rose Blush
 * Couleurs hexadécimales standardisées (sans le préfixe '#' pour la librairie docx).
 */
const PALETTE = {
  BLUSH_PRINCIPAL: 'C97A7E',   // Rose blush raffiné (titres, puces, accentuations)
  BLUSH_FONCE: '9C5559',       // Rose blush profond (en-tête de section)
  PASTEL_FOND: 'FDF6F6',       // Rose pastel très doux (arrière-plan d'encadré)
  PASTEL_BORDURE: 'ECCECE',    // Bordure rose poudré subtile
  TEXTE_PRINCIPAL: '23272F',   // Gris ardoise foncé (lecture confortable)
  TEXTE_SECONDAIRE: '6B7280',  // Gris neutre moyen (métadonnées)
  BLANC: 'FFFFFF'
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
 * Nettoie une chaîne d'actions et la découpe en tableau de lignes distinctes.
 *
 * @param {string} actionsTexte Texte brut des actions (séparé par des sauts de ligne ou puces).
 * @returns {string[]} Liste d'actions nettoyées.
 */
function extraireListeActions(actionsTexte) {
  if (!actionsTexte || typeof actionsTexte !== 'string') {
    return [];
  }

  return actionsTexte
    .split('\n')
    .map(ligne => ligne.trim())
    .filter(ligne => ligne.length > 0)
    .map(ligne => ligne.replace(/^[-*•\d.]+\s*/, ''));
}

/**
 * Génère un document Word (.docx) professionnel en mémoire vive (Buffer)
 * à partir du JSON structuré de synthèse (Google Gemini).
 *
 * @param {Object} donnees Données issues de l'analyse IA.
 * @param {string} [donnees.client] Nom du client ou intitulé du projet.
 * @param {string} [donnees.synthese] Résumé exécutif en quelques phrases.
 * @param {string} [donnees.actions] Liste des actions opérationnelles à mener.
 * @param {Object} [options] Métadonnées optionnelles.
 * @param {string} [options.titreDocument] Titre personnalisé du document.
 * @param {string} [options.auteur] Nom du rédacteur ou de l'application.
 * @returns {Promise<Buffer>} Buffer binaire du fichier Word (.docx) prêt à être transmis ou sauvegardé.
 */
async function genererDocumentWord(donnees = {}, options = {}) {
  const nomClient = (donnees.client || 'Client non spécifié').trim();
  const texteSynthese = (donnees.synthese || 'Aucune synthèse disponible pour cette séance.').trim();
  const listeActions = extraireListeActions(donnees.actions);
  const dateEmission = donnees.date && /^\d{4}-\d{2}-\d{2}$/.test(String(donnees.date).trim())
    ? formaterDateFr(new Date(donnees.date))
    : formaterDateFr();

  // 1. En-tête du document Word (discret et professionnel sur chaque page)
  const headerPage = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: 'REPORTFLOW',
            font: 'Arial',
            size: 16, // 8pt
            bold: true,
            color: PALETTE.BLUSH_PRINCIPAL
          }),
          new TextRun({
            text: `  |  Compte-rendu de réunion — ${dateEmission}`,
            font: 'Arial',
            size: 16,
            color: PALETTE.TEXTE_SECONDAIRE
          })
        ],
        spacing: { after: 120 }
      })
    ]
  });

  // 2. Pied de page institutionnel avec numérotation automatique
  const footerPage = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [
          new TextRun({
            text: 'Document confidentiel à usage interne. Généré automatiquement par ReportFlow.',
            font: 'Arial',
            size: 16,
            italics: true,
            color: PALETTE.TEXTE_SECONDAIRE
          }),
          new TextRun({
            text: '\tPage '
          }),
          new TextRun({
            children: [PageNumber.CURRENT]
          }),
          new TextRun({
            text: ' sur '
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES]
          })
        ]
      })
    ]
  });

  // 3. Encadré de synthèse exécutive (Tableau à cellule unique avec fond Rose Pastel)
  const tableauSynthese = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE
    },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      left: {
        style: BorderStyle.SINGLE,
        size: 24, // 3pt de bordure blush
        color: PALETTE.BLUSH_PRINCIPAL
      }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: {
              type: ShadingType.CLEAR,
              fill: PALETTE.PASTEL_FOND
            },
            margins: {
              top: 200,
              bottom: 200,
              left: 260,
              right: 200
            },
            children: [
              new Paragraph({
                spacing: { line: 320 },
                children: [
                  new TextRun({
                    text: texteSynthese,
                    font: 'Arial',
                    size: 22, // 11pt
                    color: PALETTE.TEXTE_PRINCIPAL
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  // 4. Construction des paragraphes du plan d'action
  const paragraphesActions = [];
  if (listeActions.length === 0) {
    paragraphesActions.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Aucune action immédiate identifiée lors de cette séance.',
            font: 'Arial',
            size: 20,
            italics: true,
            color: PALETTE.TEXTE_SECONDAIRE
          })
        ]
      })
    );
  } else {
    listeActions.forEach((action) => {
      paragraphesActions.push(
        new Paragraph({
          spacing: { before: 100, after: 100 },
          children: [
            new TextRun({
              text: '◆  ',
              font: 'Arial',
              size: 16,
              color: PALETTE.BLUSH_PRINCIPAL
            }),
            new TextRun({
              text: action,
              font: 'Arial',
              size: 21, // ~10.5pt
              color: PALETTE.TEXTE_PRINCIPAL
            })
          ]
        })
      );
    });
  }

  // 5. Assemblage complet du document
  const doc = new Document({
    creator: options.auteur || 'ReportFlow',
    title: `Compte-rendu - ${nomClient}`,
    description: `Compte-rendu de réunion généré automatiquement pour ${nomClient}`,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 2.54 cm
              bottom: 1440,
              left: 1440,
              right: 1440
            }
          }
        },
        headers: { default: headerPage },
        footers: { default: footerPage },
        children: [
          // Titre principal
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 120 },
            children: [
              new TextRun({
                text: 'Compte-Rendu de Réunion',
                font: 'Arial',
                size: 38, // 19pt
                bold: true,
                color: PALETTE.BLUSH_FONCE
              })
            ]
          }),

          // Sous-titre institutionnel
          new Paragraph({
            spacing: { after: 360 },
            children: [
              new TextRun({
                text: 'Synthèse exécutive & Plan d\'action opérationnel',
                font: 'Arial',
                size: 22,
                color: PALETTE.TEXTE_SECONDAIRE
              })
            ]
          }),

          // Bloc Métadonnées (Fiche d'identité)
          new Paragraph({
            spacing: { before: 120, after: 80 },
            children: [
              new TextRun({
                text: 'Client / Projet : ',
                font: 'Arial',
                size: 22,
                bold: true,
                color: PALETTE.TEXTE_PRINCIPAL
              }),
              new TextRun({
                text: nomClient,
                font: 'Arial',
                size: 22,
                bold: true,
                color: PALETTE.BLUSH_PRINCIPAL
              })
            ]
          }),
          new Paragraph({
            spacing: { after: 360 },
            children: [
              new TextRun({
                text: 'Date de la session : ',
                font: 'Arial',
                size: 20,
                color: PALETTE.TEXTE_SECONDAIRE
              }),
              new TextRun({
                text: dateEmission,
                font: 'Arial',
                size: 20,
                color: PALETTE.TEXTE_PRINCIPAL
              })
            ]
          }),

          // Ligne de séparation élégante
          new Paragraph({
            spacing: { after: 360 },
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 6, // 0.75pt
                color: PALETTE.PASTEL_BORDURE
              }
            }
          }),

          // Section 1 : Synthèse Exécutive
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 160 },
            children: [
              new TextRun({
                text: '1. Synthèse Exécutive',
                font: 'Arial',
                size: 26, // 13pt
                bold: true,
                color: PALETTE.BLUSH_FONCE
              })
            ]
          }),
          tableauSynthese,

          // Section 2 : Plan d'action
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 160 },
            children: [
              new TextRun({
                text: '2. Plan d\'Action Opérationnel',
                font: 'Arial',
                size: 26,
                bold: true,
                color: PALETTE.BLUSH_FONCE
              })
            ]
          }),
          ...paragraphesActions
        ]
      }
    ]
  });

  // 6. Sérialisation en mémoire vive (RAM) sous forme de Buffer
  return await Packer.toBuffer(doc);
}

module.exports = {
  genererDocumentWord,
  PALETTE
};
