const axios = require('axios');

const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

const NOTION_TIMEOUT_MS = parseInt(process.env.NOTION_TIMEOUT_MS, 10) || 30000; // Délai d'expiration par défaut (30 secondes)

/**
 * Instance Axios préconfigurée pour l'API REST Notion.
 * Inclut un timeout étendu à 30s pour absorber les variations de latence réseau.
 */
const notionClient = axios.create({
  baseURL: NOTION_API_URL,
  headers: {
    'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION
  },
  timeout: NOTION_TIMEOUT_MS
});

// Cache en mémoire des métadonnées de schémas (clé: databaseId, valeur: { schema, timestamp })
const schemaCache = new Map();
let cachedDrivePropertyName = 'Document soucre (Drive)';
const SCHEMA_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Schéma par défaut pré-chargé pour la table des comptes-rendus
schemaCache.set('3ff6955c3b648036a7b4f09d9a8f8636', {
  schema: {
    'Client / Projet': { type: 'title' },
    'Synthèse IA': { type: 'rich_text' },
    'Actions à mener': { type: 'rich_text' },
    'Date': { type: 'date' },
    'Document soucre (Drive)': { type: 'url' },
    'Statut': { type: 'status' }
  },
  timestamp: Date.now()
});

/**
 * Extrait l'identifiant Notion propre (32 caractères hexadécimaux)
 * à partir d'une chaîne brute, d'un UUID avec tirets ou d'une URL Notion complète.
 *
 * @param {string} valeur Chaîne brute, UUID ou URL Notion.
 * @returns {string} Identifiant Notion normalisé (32 caractères sans tirets).
 */
function extraireIdNotion(valeur) {
  if (!valeur) return '';
  const str = String(valeur).trim();
  // Recherche d'un UUID avec tirets ou d'une chaîne hexadécimale de 32 caractères
  const matchUuid = str.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (matchUuid) {
    return matchUuid[1].replace(/-/g, '').toLowerCase();
  }
  const matchHex = str.match(/([0-9a-f]{32})/i);
  if (matchHex) {
    return matchHex[1].replace(/-/g, '').toLowerCase();
  }
  return str.replace(/-/g, '').trim().toLowerCase();
}

/**
 * Normalise une chaîne pour faciliter les comparaisons (minuscules, sans accents, sans espaces superflus).
 *
 * @param {string} str Chaîne d'origine.
 * @returns {string} Chaîne normalisée.
 */
function normaliserTexte(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Formate une date et heure au format ISO 8601 complet avec fuseau horaire
 * pour l'API Notion (ex: "2026-10-27T14:30:00+03:00").
 * Garantit que la colonne Date dans Notion enregistre systématiquement l'horodatage précis.
 *
 * @param {string|Date|null} dateInput Date brute issue de l'analyse ou objet Date.
 * @returns {string} Horodatage ISO complet accepté par Notion.
 */
function formaterDateHeureNotion(dateInput) {
  const FUSEAU_OFFSET = '+03:00';
  const TIMEZONE_LOCALE = 'Indian/Antananarivo';
  const maintenant = new Date();

  // Heure locale courante au format HH:mm:ss
  const heureLocale = maintenant.toLocaleTimeString('fr-FR', {
    timeZone: TIMEZONE_LOCALE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Date locale courante au format YYYY-MM-DD
  const jourLocal = maintenant.toLocaleDateString('en-CA', {
    timeZone: TIMEZONE_LOCALE
  });

  if (!dateInput || String(dateInput).trim().toLowerCase() === 'null') {
    return `${jourLocal}T${heureLocale}${FUSEAU_OFFSET}`;
  }

  const str = String(dateInput).trim();

  // Déjà complet avec offset (ex: 2026-10-27T14:30:00+03:00 ou 2026-10-27T14:30:00.000+03:00)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{3})?([+-]\d{2}:?\d{2}|Z)$/.test(str)) {
    return str;
  }

  // Date + Heure sans offset (ex: 2026-10-27T14:30:00 ou 2026-10-27 14:30)
  const matchDateTime = str.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}(?::\d{2})?)/);
  if (matchDateTime) {
    const d = matchDateTime[1];
    let t = matchDateTime[2];
    if (t.length === 5) t += ':00';
    return `${d}T${t}${FUSEAU_OFFSET}`;
  }

  // Date seule (ex: 2026-10-27) -> On enrichit avec l'heure locale courante pour que Notion reçoive l'heure
  const matchDate = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (matchDate) {
    return `${matchDate[1]}T${heureLocale}${FUSEAU_OFFSET}`;
  }

  return `${jourLocal}T${heureLocale}${FUSEAU_OFFSET}`;
}

/**
 * Récupère le schéma complet d'une base de données Notion avec mise en cache par identifiant.
 *
 * @param {string} databaseId Identifiant de la base Notion.
 * @returns {Promise<Object>} Propriétés de la base.
 */
async function getDatabaseSchema(databaseId) {
  const normId = extraireIdNotion(databaseId);
  if (!normId) return {};

  const maintenant = Date.now();
  const cached = schemaCache.get(normId);
  if (cached && (maintenant - cached.timestamp < SCHEMA_CACHE_TTL_MS)) {
    return cached.schema;
  }

  try {
    const dbRes = await notionClient.get(`/databases/${normId}`);
    const schema = dbRes.data?.properties || {};
    schemaCache.set(normId, { schema, timestamp: maintenant });
    return schema;
  } catch (err) {
    console.warn(`[NotionService] Note lecture schéma base (${normId}) :`, err.response?.data?.message || err.message);
    return {};
  }
}

/**
 * Réinitialise tous les caches de schéma en cas de modification de colonnes dans Notion.
 */
function invaliderCachesSchema() {
  cachedDrivePropertyName = null;
  schemaCache.clear();
}

/**
 * Résout l'identifiant exact de la base de données Notion.
 * Si l'ID fourni est une page contenant une base inline, découvre automatiquement l'ID de la base enfant.
 *
 * @param {string} rawId Identifiant brut, URL ou UUID.
 * @returns {Promise<string>} Identifiant résolu de la base de données.
 */
async function resoudreDatabaseId(rawId) {
  const cleanId = extraireIdNotion(rawId);
  if (!cleanId) return cleanId;

  // 1. Tester directement l'accès à la base de données
  try {
    const resDb = await notionClient.get(`/databases/${cleanId}`);
    if (resDb.data?.id) {
      return cleanId;
    }
  } catch (errDb) {
    // 2. Si 404 ou 400, vérifier s'il s'agit d'une page parente contenant une base enfant (inline database)
    if (errDb.response?.status === 404 || errDb.response?.status === 400) {
      try {
        const blocksRes = await notionClient.get(`/blocks/${cleanId}/children?page_size=20`);
        const childDb = blocksRes.data?.results?.find(b => b.type === 'child_database');
        if (childDb && childDb.id) {
          const resolved = extraireIdNotion(childDb.id);
          console.log(`[NotionService] Base inline résolue (${cleanId} -> ${resolved})`);
          return resolved;
        }
      } catch (errBlocks) {
        // Silencieux
      }
    }
  }

  return cleanId;
}

/**
 * Résout dynamiquement le nom exact de la colonne URL dans la base des comptes-rendus
 * (gère 'Document soucre (Drive)', 'Document source (Drive)', 'Lien Document (Drive)', etc.).
 *
 * @param {string} databaseId Identifiant de la base Notion.
 * @returns {Promise<string|null>} Nom exact de la propriété ou fallback.
 */
async function resolveDriveProperty(databaseId) {
  if (cachedDrivePropertyName) return cachedDrivePropertyName;

  try {
    const props = await getDatabaseSchema(databaseId);

    // 1. Recherche par correspondance exacte parmi les noms connus
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

    // Détection heuristique d'une colonne URL associée à Drive ou aux documents
    const heuristicMatch = Object.keys(props).find(key => {
      return props[key]?.type === 'url' && /drive|document|source|soucre|lien/i.test(key);
    });

    if (heuristicMatch) {
      cachedDrivePropertyName = heuristicMatch;
      return heuristicMatch;
    }
  } catch (err) {
    console.warn('[NotionService] Impossible de vérifier la colonne Drive dans Notion :', err.message);
  }

  // Fallback par défaut sur le nom de propriété standard
  return 'Document soucre (Drive)';
}

/**
 * Recherche un client existant dans la base 'Clients et prospects'.
 * Combine une requête filtrée, un fallback global sans filtre et une comparaison multi-niveaux.
 *
 * @param {Object} params
 * @param {string} params.nomClient Nom extrait par l'IA.
 * @param {string} params.clientsDbId ID de la base 'Clients et prospects'.
 * @param {string} [params.clientsTitlePropName] Colonne titre de la base clients (ex: 'Nom').
 * @returns {Promise<{ id: string, name: string, properties: Object }|null>} Fiche client trouvée ou null.
 */
async function rechercherClientProspect({ nomClient, clientsDbId, clientsTitlePropName }) {
  if (!nomClient || !clientsDbId) return null;

  const nomNettoye = nomClient.trim();
  if (!nomNettoye || nomNettoye.toLowerCase() === 'null') return null;

  const cleanDbId = extraireIdNotion(clientsDbId);

  try {
    let pages = [];

    // Niveau 1 : Requête Notion avec filtre 'contains' si la colonne titre est connue
    if (clientsTitlePropName) {
      try {
        const queryRes = await notionClient.post(`/databases/${cleanDbId}/query`, {
          filter: {
            property: clientsTitlePropName,
            title: {
              contains: nomNettoye
            }
          },
          page_size: 25
        });
        pages = queryRes.data?.results || [];
      } catch (errFilter) {
        // En cas d'incompatibilité de filtre ou nom de colonne, basculer sur le niveau 2
      }
    }

    // Niveau 2 : Si aucun résultat ou filtre rejeté, requête directe de l'ensemble des fiches
    if (pages.length === 0) {
      try {
        const allRes = await notionClient.post(`/databases/${cleanDbId}/query`, {
          page_size: 100
        });
        pages = allRes.data?.results || [];
      } catch (errAll) {
        console.warn(`[NotionService] Erreur interrogation base clients (${cleanDbId}) :`, errAll.response?.data?.message || errAll.message);
        return null;
      }
    }

    if (pages.length === 0) {
      return null;
    }

    // Extraction du libellé titre de la fiche
    const extraireTitre = (page) => {
      if (clientsTitlePropName && page.properties?.[clientsTitlePropName]?.title) {
        const parts = page.properties[clientsTitlePropName].title;
        return parts.map(p => p.plain_text || p.text?.content || '').join('').trim();
      }
      for (const prop of Object.values(page.properties || {})) {
        if (prop.type === 'title') {
          const parts = prop.title || [];
          return parts.map(p => p.plain_text || p.text?.content || '').join('').trim();
        }
      }
      return '';
    };

    const cibleNormalisee = normaliserTexte(nomNettoye);

    // Niveau 1 : Correspondance exacte normalisée (insensible à la casse et aux accents)
    for (const page of pages) {
      const titrePage = extraireTitre(page);
      if (normaliserTexte(titrePage) === cibleNormalisee) {
        return { id: page.id, name: titrePage, properties: page.properties };
      }
    }

    // Niveau 2 : Correspondance par sous-chaîne
    for (const page of pages) {
      const titrePage = extraireTitre(page);
      const titreNorm = normaliserTexte(titrePage);
      if (titreNorm && (titreNorm.includes(cibleNormalisee) || cibleNormalisee.includes(titreNorm))) {
        return { id: page.id, name: titrePage, properties: page.properties };
      }
    }

    // Niveau 3 : Correspondance par lexème distinctif
    const motsCible = cibleNormalisee.split(/\s+/).filter(m => m.length >= 4 && !['demo', 'projet', 'client', 'pour', 'societe'].includes(m));
    for (const mot of motsCible) {
      for (const page of pages) {
        const titrePage = extraireTitre(page);
        const titreNorm = normaliserTexte(titrePage);
        if (titreNorm.includes(mot)) {
          return { id: page.id, name: titrePage, properties: page.properties };
        }
      }
    }

    // Niveau 4 : Association unitaire si base à fiche unique
    if (pages.length === 1) {
      const titrePage = extraireTitre(pages[0]);
      return { id: pages[0].id, name: titrePage, properties: pages[0].properties };
    }

    return null;

  } catch (errQuery) {
    console.warn(`[NotionService] Note recherche client "${nomNettoye}" :`, errQuery.response?.data?.message || errQuery.message);
    return null;
  }
}

/**
 * Récupère les informations d'une fiche client Notion à partir de son identifiant de page.
 *
 * @param {string} pageId Identifiant Notion de la page client.
 * @returns {Promise<{ id: string, name: string, properties: Object }|null>}
 */
async function recupererClientParId(pageId) {
  if (!pageId) return null;
  try {
    const cleanId = extraireIdNotion(pageId);
    const res = await notionClient.get(`/pages/${cleanId}`);
    let name = '';
    for (const prop of Object.values(res.data?.properties || {})) {
      if (prop.type === 'title') {
        name = (prop.title || []).map(p => p.plain_text || p.text?.content || '').join('').trim();
        break;
      }
    }
    return { id: res.data.id, name, properties: res.data.properties };
  } catch (err) {
    console.warn(`[NotionService] Note lecture client par ID (${pageId}) :`, err.response?.data?.message || err.message);
    return null;
  }
}

/**
 * Recherche un projet existant dans la base 'Projets'.
 * Utilise une recherche multi-niveaux (exacte, sous-chaîne, mots-clés spécifiques).
 *
 * @param {Object} params
 * @param {string} params.nomProjet Nom ou sujet du projet à rechercher.
 * @param {string} params.projetsDbId Identifiant de la base 'Projets'.
 * @returns {Promise<{ id: string, name: string, properties: Object, clientRelationIds: string[] }|null>}
 */
async function rechercherProjet({ nomProjet, projetsDbId }) {
  if (!nomProjet || !projetsDbId) return null;

  const nomNettoye = nomProjet.trim();
  if (!nomNettoye || nomNettoye.toLowerCase() === 'null') return null;

  const cleanDbId = extraireIdNotion(projetsDbId);
  try {
    const resolvedDbId = await resoudreDatabaseId(cleanDbId);
    const schema = await getDatabaseSchema(resolvedDbId);

    let titleProp = 'Nom du projet';
    let clientRelProp = 'Client';

    for (const [key, prop] of Object.entries(schema)) {
      if (prop.type === 'title') {
        titleProp = key;
      } else if (prop.type === 'relation' && normaliserTexte(key).includes('client')) {
        clientRelProp = key;
      }
    }

    const queryRes = await notionClient.post(`/databases/${resolvedDbId}/query`, {
      page_size: 100
    });
    const pages = queryRes.data?.results || [];
    if (pages.length === 0) return null;

    const extraireTitre = (page) => {
      const parts = page.properties?.[titleProp]?.title || [];
      if (parts.length > 0) return parts.map(p => p.plain_text || p.text?.content || '').join('').trim();
      for (const prop of Object.values(page.properties || {})) {
        if (prop.type === 'title') {
          return (prop.title || []).map(p => p.plain_text || p.text?.content || '').join('').trim();
        }
      }
      return '';
    };

    const cibleNormalisee = normaliserTexte(nomNettoye);

    // Niveau 1 : Correspondance exacte insensible à la casse et aux accents
    for (const page of pages) {
      const titrePage = extraireTitre(page);
      if (normaliserTexte(titrePage) === cibleNormalisee) {
        return {
          id: page.id,
          name: titrePage,
          properties: page.properties,
          clientRelationIds: (page.properties?.[clientRelProp]?.relation || []).map(r => r.id)
        };
      }
    }

    // Niveau 2 : Correspondance par sous-chaîne
    for (const page of pages) {
      const titrePage = extraireTitre(page);
      const titreNorm = normaliserTexte(titrePage);
      if (titreNorm && (titreNorm.includes(cibleNormalisee) || cibleNormalisee.includes(titreNorm))) {
        return {
          id: page.id,
          name: titrePage,
          properties: page.properties,
          clientRelationIds: (page.properties?.[clientRelProp]?.relation || []).map(r => r.id)
        };
      }
    }

    // Niveau 3 : Mots-clés distinctifs
    const stopWords = ['projet', 'pour', 'avec', 'sur', 'dans', 'demo', 'etude', 'de', 'du', 'des', 'un', 'une', 'le', 'la', 'les'];
    const motsCible = cibleNormalisee.split(/\s+/).filter(m => m.length >= 4 && !stopWords.includes(m));
    for (const page of pages) {
      const titrePage = extraireTitre(page);
      const titreNorm = normaliserTexte(titrePage);
      const motsTrouves = motsCible.filter(m => titreNorm.includes(m));
      if (motsTrouves.length >= 2 || (motsCible.length === 1 && motsTrouves.length === 1)) {
        return {
          id: page.id,
          name: titrePage,
          properties: page.properties,
          clientRelationIds: (page.properties?.[clientRelProp]?.relation || []).map(r => r.id)
        };
      }
    }

    // Niveau 4 : Association unitaire si base à fiche unique
    if (pages.length === 1) {
      const titrePage = extraireTitre(pages[0]);
      return {
        id: pages[0].id,
        name: titrePage,
        properties: pages[0].properties,
        clientRelationIds: (pages[0].properties?.[clientRelProp]?.relation || []).map(r => r.id)
      };
    }

    return null;
  } catch (errQuery) {
    console.warn(`[NotionService] Note recherche projet "${nomNettoye}" :`, errQuery.response?.data?.message || errQuery.message);
    return null;
  }
}

/**
 * Découpe un texte en blocs de 2000 caractères maximum pour respecter
 * le plafond strict imposé par l'API Notion sur chaque élément de rich_text.
 *
 * @param {string} texte Texte complet.
 * @returns {Array<Object>} Tableau d'objets textuels Notion.
 */
function creerRichTextPayload(texte) {
  if (!texte) return [];
  const MAX_CHUNK = 2000;
  const str = String(texte);
  const chunks = [];
  for (let i = 0; i < str.length; i += MAX_CHUNK) {
    chunks.push({
      text: { content: str.substring(i, i + MAX_CHUNK) }
    });
  }
  return chunks;
}

/**
 * Rapproche et associe le compte-rendu dans la colonne 'Rapports' de la fiche client
 * située dans la base 'Clients et prospects'.
 *
 * @param {Object} params
 * @param {string} params.clientNom Nom du client extrait par Gemini.
 * @param {string} params.reportPageId Identifiant de la page du compte-rendu créée.
 * @returns {Promise<boolean>} True si le rapport a été rattaché avec succès.
 */
async function rattacherRapportAuClient({ clientNom, reportPageId }) {
  if (!clientNom || !reportPageId) return false;

  const rawClientsDbId = process.env.NOTION_CLIENTS_DB_ID || '4016955c3b648027b316cccecb1c3bd9';
  const clientsDbId = extraireIdNotion(rawClientsDbId);
  if (!clientsDbId) return false;

  const nomNettoye = clientNom.trim();
  if (!nomNettoye || nomNettoye.toLowerCase() === 'null' || nomNettoye.toLowerCase() === 'projet non spécifié') {
    return false;
  }

  try {
    // 1. Résolution de l'identifiant de la table (gère table principale ou inline database)
    const resolvedDbId = await resoudreDatabaseId(clientsDbId);

    // 2. Découverte dynamique de la colonne titre et de la colonne relation
    const clientsSchema = await getDatabaseSchema(resolvedDbId);
    let clientsTitleProp = 'Nom';
    let rapportsColName = 'Rapports';

    for (const [key, prop] of Object.entries(clientsSchema)) {
      if (prop.type === 'title') {
        clientsTitleProp = key;
      } else if (prop.type === 'relation') {
        const lowerKey = normaliserTexte(key);
        if (lowerKey.includes('rapport')) {
          rapportsColName = key;
        }
      }
    }

    // 3. Recherche de la fiche client correspondante (ex: 'Ravinala Logistique Demo')
    const clientTrouve = await rechercherClientProspect({
      nomClient: nomNettoye,
      clientsDbId: resolvedDbId,
      clientsTitlePropName: clientsTitleProp
    });

    if (!clientTrouve || !clientTrouve.id) {
      console.log(`[NotionService] Entité "${nomNettoye}" non répertoriée dans la table clients. Rattachement ignoré.`);
      return false;
    }

    // 4. Déterminer la colonne de relation exacte sur la fiche client si non détectée au schéma
    if (!clientTrouve.properties?.[rapportsColName]) {
      for (const [key, prop] of Object.entries(clientTrouve.properties || {})) {
        if (prop.type === 'relation') {
          const lowerKey = normaliserTexte(key);
          if (lowerKey.includes('rapport')) {
            rapportsColName = key;
            break;
          }
        }
      }
    }

    // 5. Récupération des relations existantes pour préserver l'historique des réunions passées
    let relationsExistantes = [];
    try {
      const clientPageRes = await notionClient.get(`/pages/${clientTrouve.id}`);
      const propRapports = clientPageRes.data?.properties?.[rapportsColName];
      if (propRapports && Array.isArray(propRapports.relation)) {
        relationsExistantes = propRapports.relation.map(r => ({ id: r.id }));
      }
    } catch (errPage) {
      if (clientTrouve.properties?.[rapportsColName]?.relation) {
        relationsExistantes = clientTrouve.properties[rapportsColName].relation.map(r => ({ id: r.id }));
      }
    }

    // Si le rapport n'est pas déjà lié, on l'ajoute
    const cleanReportId = extraireIdNotion(reportPageId);
    const dejaPresent = relationsExistantes.some(r => extraireIdNotion(r.id) === cleanReportId);
    if (!dejaPresent) {
      relationsExistantes.push({ id: reportPageId });
    }

    // 6. Mise à jour de la fiche client (PATCH) pour remplir la colonne 'Rapports'
    await notionClient.patch(`/pages/${clientTrouve.id}`, {
      properties: {
        [rapportsColName]: {
          relation: relationsExistantes
        }
      }
    });

    console.log(`[NotionService] Compte-rendu associé avec succès à la fiche client "${clientTrouve.name}" (champ: "${rapportsColName}").`);
    return true;

  } catch (err) {
    const status = err.response?.status;
    const detailApi = err.response?.data?.message || err.message;
    if (status === 404) {
      console.warn(`[NotionService] Erreur 404 sur la base clients : l'intégration Notion ne dispose pas des droits d'accès sur la ressource (${clientsDbId}). Vérifier le partage de la page dans Notion.`);
    } else {
      console.warn(`[NotionService] Erreur d'association au client "${nomNettoye}" :`, detailApi);
    }
    return false;
  }
}

/**
 * Rapproche et associe le compte-rendu dans la colonne 'Rapports' de la fiche projet
 * située dans la base 'Projets'.
 *
 * @param {Object} params
 * @param {string} params.projetId Identifiant de la page projet.
 * @param {string} params.reportPageId Identifiant de la page du compte-rendu créée.
 * @returns {Promise<boolean>} True si le rapport a été rattaché avec succès.
 */
async function rattacherRapportAuProjet({ projetId, reportPageId }) {
  if (!projetId || !reportPageId) return false;

  try {
    const cleanProjetId = extraireIdNotion(projetId);
    const projetPageRes = await notionClient.get(`/pages/${cleanProjetId}`);
    const props = projetPageRes.data?.properties || {};

    let rapportsColName = 'Rapports';
    for (const [key, prop] of Object.entries(props)) {
      if (prop.type === 'relation') {
        const lowerKey = normaliserTexte(key);
        if (lowerKey.includes('rapport')) {
          rapportsColName = key;
          break;
        }
      }
    }

    let relationsExistantes = (props[rapportsColName]?.relation || []).map(r => ({ id: r.id }));
    const cleanReportId = extraireIdNotion(reportPageId);
    if (!relationsExistantes.some(r => extraireIdNotion(r.id) === cleanReportId)) {
      relationsExistantes.push({ id: reportPageId });
      await notionClient.patch(`/pages/${cleanProjetId}`, {
        properties: {
          [rapportsColName]: {
            relation: relationsExistantes
          }
        }
      });
      console.log(`[NotionService] Compte-rendu associé avec succès à la fiche projet "${cleanProjetId}" (champ: "${rapportsColName}").`);
    }
    return true;
  } catch (err) {
    console.warn('[NotionService] Note rattachement projet :', err.response?.data?.message || err.message);
    return false;
  }
}

/**
 * Insère une nouvelle ligne dans la base de données Notion avec les données du compte-rendu.
 * Effectue automatiquement le rattachement relationnel au Projet et au Client dans Notion.
 *
 * @param {Object} data Données structurées issues de l'analyse.
 * @param {string} [data.titre] Titre représentatif et explicite du compte-rendu.
 * @param {string} [data.client] Nom du client ou de l'organisation.
 * @param {string} [data.projet] Intitulé ou sujet du projet.
 * @param {string} [data.date] Date de réunion au format YYYY-MM-DD.
 * @param {string} data.synthese Synthèse exécutive rédigée.
 * @param {string} data.actions Actions à entreprendre.
 * @param {string} [data.lienDrive] Lien web vers le document Google Drive.
 * @returns {Promise<{ id: string, titre: string, projetId: string|null, projetNom: string|null, clientId: string|null, clientNom: string|null }>}
 */
async function insererCompteRendu({ titre, client, projet, date, synthese, actions, lienDrive }) {
  const databaseId = extraireIdNotion(process.env.DATABASE_ID);
  if (!databaseId) {
    throw new Error('DATABASE_ID est manquant dans les variables d\'environnement.');
  }

  // 1. Découverte dynamique du schéma de la table des rapports
  let titleColName = 'Client / Projet';
  let colRelationProjet = null;
  let colRelationClient = null;

  const projetsDbId = extraireIdNotion(process.env.NOTION_PROJETS_DB_ID || '4016955c3b6480ceb4f7d2c6190f84fc');
  const clientsDbId = extraireIdNotion(process.env.NOTION_CLIENTS_DB_ID || '4016955c3b648027b316cccecb1c3bd9');

  try {
    const repSchema = await getDatabaseSchema(databaseId);
    for (const [key, prop] of Object.entries(repSchema)) {
      if (prop.type === 'title') {
        titleColName = key;
      } else if (prop.type === 'relation') {
        const targetDbId = extraireIdNotion(prop.relation?.database_id);
        const normKey = normaliserTexte(key);
        if (targetDbId === projetsDbId || normKey.includes('projet')) {
          colRelationProjet = key;
        } else if (targetDbId === clientsDbId || normKey.includes('client')) {
          colRelationClient = key;
        }
      }
    }
  } catch (errSchema) {
    console.warn('[NotionService] Lecture schéma rapports :', errSchema.message);
  }

  // 2. Recherche et résolution du projet correspondant
  let projetTrouve = null;
  if (projet && String(projet).trim()) {
    try {
      projetTrouve = await rechercherProjet({
        nomProjet: String(projet).trim(),
        projetsDbId
      });
      if (projetTrouve) {
        console.log(`[NotionService] Projet identifié dans Notion : "${projetTrouve.name}" (${projetTrouve.id})`);
      }
    } catch (errP) {
      console.warn('[NotionService] Recherche projet :', errP.message);
    }
  }

  // 3. Recherche et résolution du client correspondant
  let clientTrouve = null;
  if (client && String(client).trim()) {
    try {
      clientTrouve = await rechercherClientProspect({
        nomClient: String(client).trim(),
        clientsDbId
      });
      if (clientTrouve) {
        console.log(`[NotionService] Client identifié dans Notion : "${clientTrouve.name}" (${clientTrouve.id})`);
      }
    } catch (errC) {
      console.warn('[NotionService] Recherche client :', errC.message);
    }
  }

  // Déduction intelligente : si le client n'a pas été cité ou trouvé, mais que le projet possède un client lié dans Notion
  if (!clientTrouve && projetTrouve && Array.isArray(projetTrouve.clientRelationIds) && projetTrouve.clientRelationIds.length > 0) {
    try {
      const clientDeduit = await recupererClientParId(projetTrouve.clientRelationIds[0]);
      if (clientDeduit) {
        clientTrouve = clientDeduit;
        console.log(`[NotionService] Client déduit automatiquement via le projet "${projetTrouve.name}" : "${clientTrouve.name}"`);
      }
    } catch (errDeduit) {
      console.warn('[NotionService] Déduction client via projet :', errDeduit.message);
    }
  }

  // Formatage de la date et heure ISO 8601 pour Notion (YYYY-MM-DDTHH:mm:ss+03:00)
  const dateHeureValide = formaterDateHeureNotion(date);

  // Détermination du titre percutant de la fiche rapport
  let titreFinal = titre && String(titre).trim() ? String(titre).trim() : '';
  if (!titreFinal) {
    if (projetTrouve && clientTrouve) {
      titreFinal = `Point d'avancement - ${projetTrouve.name}`;
    } else if (projetTrouve) {
      titreFinal = `Compte-rendu - ${projetTrouve.name}`;
    } else if (clientTrouve) {
      titreFinal = `Compte-rendu de réunion - ${clientTrouve.name}`;
    } else {
      titreFinal = 'Compte-rendu de réunion opérationnelle';
    }
  }

  const payload = {
    parent: { database_id: databaseId },
    properties: {
      [titleColName]: {
        title: [{ text: { content: titreFinal.substring(0, 2000) } }]
      },
      'Synthèse IA': {
        rich_text: creerRichTextPayload(synthese)
      },
      'Actions à mener': {
        rich_text: creerRichTextPayload(actions)
      },
      'Date': {
        date: { start: dateHeureValide }
      }
    }
  };

  // Liaison relationnelle directe au Projet dans la table des Rapports
  if (colRelationProjet && projetTrouve?.id) {
    payload.properties[colRelationProjet] = {
      relation: [{ id: projetTrouve.id }]
    };
  }

  // Liaison relationnelle directe au Client dans la table des Rapports
  if (colRelationClient && clientTrouve?.id) {
    payload.properties[colRelationClient] = {
      relation: [{ id: clientTrouve.id }]
    };
  }

  // Résolution et injection du lien Google Drive
  let resolvedDriveCol = null;
  if (lienDrive) {
    resolvedDriveCol = await resolveDriveProperty(databaseId);
    if (resolvedDriveCol) {
      payload.properties[resolvedDriveCol] = {
        url: lienDrive
      };
    }
  }

  // Création de l'enregistrement dans la base des comptes-rendus
  let reportPageId = null;
  try {
    const response = await notionClient.post('/pages', payload);
    reportPageId = response.data.id;
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message || '';
    const status = err.response?.status;
    console.warn('[NotionService] Échec insertion Notion :', errMsg);

    const isTimeout = err.code === 'ECONNABORTED' || errMsg.toLowerCase().includes('timeout') || errMsg.toLowerCase().includes('etimedout');

    if (isTimeout) {
      console.warn('[NotionService] Latence réseau détectée. Nouvelle tentative d\'insertion...');
      try {
        await new Promise(r => setTimeout(r, 1500));
        const retryResponse = await notionClient.post('/pages', payload);
        reportPageId = retryResponse.data.id;
      } catch (errTimeoutRetry) {
        console.warn('[NotionService] Échec persistant après nouvelle tentative réseau :', errTimeoutRetry.message);
      }
    } else if (status === 400 && resolvedDriveCol && payload.properties[resolvedDriveCol]) {
      // Rejet par Notion sur la colonne URL spécifique
      console.warn(`[NotionService] Colonne Drive "${resolvedDriveCol}" non reconnue. Nouvel essai sans lien Drive...`);
      delete payload.properties[resolvedDriveCol];
      invaliderCachesSchema();
      try {
        const retryResponse = await notionClient.post('/pages', payload);
        reportPageId = retryResponse.data.id;
      } catch (errRetryDrive) {
        console.warn('[NotionService] Échec persistant après retrait Drive :', errRetryDrive.response?.data?.message || errRetryDrive.message);
      }
    }

    if (!reportPageId) {
      const detailApi = err.response?.data?.message || err.message;
      const error = new Error(`Erreur Notion API : ${detailApi}`);
      error.details = err.response?.data || null;
      throw error;
    }
  }

  // Synchronisation bidirectionnelle sur la fiche Client
  if (reportPageId && clientTrouve?.id) {
    try {
      await rattacherRapportAuClient({
        clientNom: clientTrouve.name,
        reportPageId
      });
    } catch (errRelClient) {
      console.warn('[NotionService] Note synchronisation client :', errRelClient.message);
    }
  }

  // Synchronisation bidirectionnelle sur la fiche Projet
  if (reportPageId && projetTrouve?.id) {
    try {
      await rattacherRapportAuProjet({
        projetId: projetTrouve.id,
        reportPageId
      });
    } catch (errRelProjet) {
      console.warn('[NotionService] Note synchronisation projet :', errRelProjet.message);
    }
  }

  return {
    id: reportPageId,
    titre: titreFinal,
    projetId: projetTrouve?.id || null,
    projetNom: projetTrouve?.name || null,
    clientId: clientTrouve?.id || null,
    clientNom: clientTrouve?.name || null
  };
}

module.exports = {
  insererCompteRendu,
  rattacherRapportAuClient,
  rattacherRapportAuProjet,
  rechercherProjet,
  rechercherClientProspect,
  recupererClientParId
};
