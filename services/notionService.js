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

// Cache en mémoire du nom de la colonne Notion stockant l'URL Drive
let cachedDrivePropertyName = null;

/**
 * Résout dynamiquement le nom exact de la colonne URL dans la base Notion
 * (gère 'Document soucre (Drive)', 'Document source (Drive)', 'Lien Document (Drive)', etc.).
 *
 * @param {string} databaseId Identifiant de la base Notion.
 * @returns {Promise<string|null>} Nom exact de la propriété ou fallback.
 */
async function resolveDriveProperty(databaseId) {
  if (cachedDrivePropertyName) return cachedDrivePropertyName;

  try {
    const dbRes = await notionClient.get(`/databases/${databaseId}`);
    const props = dbRes.data?.properties || {};

    // 1. Recherche par correspondance exacte parmi les noms connus (y compris coquilles)
    const knownCandidates = [
      'Document soucre (Drive)',
      'Document source (Drive)',
      'Lien Document (Drive)',
      'Document Drive',
      'Lien Drive'
    ];

    const exactMatch = knownCandidates.find(name => props[name] && props[name].type === 'url');
    if (exactMatch) {
      cachedDrivePropertyName = exactMatch;
      return exactMatch;
    }

    // 2. Recherche heuristique : toute propriété de type 'url' dont l'intitulé évoque Drive / Document
    const heuristicMatch = Object.keys(props).find(key => {
      return props[key]?.type === 'url' && /drive|document|source|soucre|lien/i.test(key);
    });

    if (heuristicMatch) {
      cachedDrivePropertyName = heuristicMatch;
      return heuristicMatch;
    }
  } catch (err) {
    console.warn('[NotionService] Impossible de vérifier le schéma de la base Notion :', err.message);
  }

  // Fallback par défaut sur le nom actuellement présent dans Notion
  return 'Document soucre (Drive)';
}

/**
 * Insère une nouvelle ligne dans la base de données Notion avec les données du compte-rendu.
 *
 * @param {Object} data Données structurées issues de l'analyse.
 * @param {string} data.client Nom du client ou intitulé du projet.
 * @param {string} data.synthese Synthèse exécutive rédigée.
 * @param {string} data.actions Actions à entreprendre.
 * @param {string} [data.lienDrive] Lien web vers le document Google Drive.
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

  // Ajout dynamique du lien Google Drive si disponible
  let resolvedDriveCol = null;
  if (lienDrive) {
    resolvedDriveCol = await resolveDriveProperty(databaseId);
    if (resolvedDriveCol) {
      payload.properties[resolvedDriveCol] = {
        url: lienDrive
      };
    }
  }

  try {
    const response = await notionClient.post('/pages', payload);
    return response.data.id;
  } catch (err) {
    // Si la colonne n'existe plus ou a été modifiée dans Notion, on invalide le cache et retente sans bloquer
    if (resolvedDriveCol && err.response?.data?.message?.includes('is not a property that exists')) {
      console.warn(`[NotionService] Colonne "${resolvedDriveCol}" non reconnue dans Notion. Enregistrement sans cette colonne...`);
      cachedDrivePropertyName = null;
      delete payload.properties[resolvedDriveCol];
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
