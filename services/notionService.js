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
async function insererCompteRendu({ client, synthese, actions }) {
  const databaseId = process.env.DATABASE_ID;
  if (!databaseId) {
    throw new Error('DATABASE_ID est manquant dans les variables d\'environnement.');
  }

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
      }
    }
  };

  try {
    const response = await notionClient.post('/pages', payload);
    return response.data.id;
  } catch (err) {
    // Extraction des détails spécifiques renvoyés par l'API Notion (validation de schéma, permissions, etc.)
    const detailApi = err.response?.data?.message || err.message;
    const error = new Error(`Erreur Notion API : ${detailApi}`);
    error.details = err.response?.data || null;
    throw error;
  }
}

module.exports = {
  insererCompteRendu
};
