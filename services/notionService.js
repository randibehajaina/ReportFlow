const axios = require('axios');

const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

/**
 * Instance Axios préconfigurée pour l'API REST Notion.
 * Inclut un timeout pour éviter de bloquer indéfiniment les requêtes en cas de latence réseau.
 */
const notionClient = axios.create({
  baseURL: NOTION_API_URL,
  headers: {
    'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION
  },
  timeout: 10000
});

/**
 * Insère une nouvelle ligne dans la base de données Notion avec les données du compte-rendu.
 *
 * @param {Object} data Données structurées issues de l'analyse.
 * @param {string} data.client Nom du client ou intitulé du projet.
 * @param {string} data.synthese Synthèse exécutive rédigée.
 * @param {string} data.actions Actions à entreprendre.
 * @returns {Promise<string>} Identifiant unique de la page Notion créée.
 */
async function insererCompteRendu({ client, date, synthese, actions, lienDrive }) {
  const databaseId = process.env.DATABASE_ID;
  if (!databaseId) {
    throw new Error('DATABASE_ID est manquant dans les variables d\'environnement.');
  }

  // Si l'IA a extrait une date au format YYYY-MM-DD, on l'utilise ; sinon on applique la date du jour
  const dateValide = date && /^\d{4}-\d{2}-\d{2}$/.test(String(date).trim())
    ? String(date).trim()
    : new Date().toISOString().split('T')[0];

  const payload = {
    parent: { database_id: databaseId },
    properties: {
      'Client / Projet': {
        title: [{ text: { content: client || 'Projet non spécifié' } }]
      },
      'Synthèse IA': {
        rich_text: [{ text: { content: synthese || '' } }]
      },
      'Actions à mener': {
        rich_text: [{ text: { content: actions || '' } }]
      },
      'Date': {
        date: { start: dateValide }
      }
    }
  };

  // Ajout du lien Google Drive si disponible
  if (lienDrive) {
    payload.properties['Lien Document (Drive)'] = {
      url: lienDrive
    };
  }

  try {
    const response = await notionClient.post('/pages', payload);
    return response.data.id;
  } catch (err) {
    // Si la colonne 'Lien Document (Drive)' n'a pas encore été créée dans Notion par l'utilisateur,
    // on retente automatiquement sans cette propriété pour ne jamais bloquer la création de la fiche.
    if (lienDrive && err.response?.data?.message?.includes('Lien Document (Drive) is not a property that exists')) {
      console.warn('[NotionService] Colonne "Lien Document (Drive)" non trouvée dans Notion. Enregistrement sans cette colonne...');
      delete payload.properties['Lien Document (Drive)'];
      const retryResponse = await notionClient.post('/pages', payload);
      return retryResponse.data.id;
    }

    // Extraction des détails spécifiques renvoyés par l'API Notion
    const detailApi = err.response?.data?.message || err.message;
    const error = new Error(`Erreur Notion API : ${detailApi}`);
    error.details = err.response?.data || null;
    throw error;
  }
}

module.exports = {
  insererCompteRendu
};
