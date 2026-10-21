# ReportFlow

> Plateforme d'automatisation pour la synthèse de réunions et la synchronisation continue vers Notion, propulsée par Google Gemini.

---

## Présentation

**ReportFlow** est une application web conçue pour automatiser le traitement post-réunion. Elle permet d'ingérer des notes textuelles brutes, des documents de synthèse (PDF, Word) ou des enregistrements audio de réunions (jusqu'à 2 heures / 200 Mo), d'en extraire les points clés de manière structurée via l'intelligence artificielle multimodale, et de créer automatiquement une fiche exploitable dans une base de données **Notion**.

---

## Fonctionnalités

- **Traitement audio longue durée** : Prise en charge des enregistrements de réunions et mémos vocaux (`.mp3`, `.m4a`, `.wav`, `.aac`, `.ogg`, `.flac`, `.webm`) jusqu'à **200 Mo** (~2 heures).
- **Analyse multimodale de documents** : Lecture native de fichiers PDF vectoriels et extraction de texte de documents Word (`.docx`) et texte brut (`.txt`).
- **Saisie directe de notes** : Éditeur avec métriques en temps réel (compteur de mots et de caractères) et raccourcis clavier (`Ctrl + Entrée`).
- **Architecture IA hybride et résiliente** :
  - *Fichiers < 20 Mo* : Encodage direct en mémoire vive (Base64 `inlineData`) pour une latence minimale sans écriture disque.
  * *Fichiers ≥ 20 Mo* : Téléversement sécurisé vers l'API Google Files officielle (`ai.files.upload`) avec suppression automatique locale et distante dès l'analyse terminée.
  * *Chaîne de secours multi-modèles (Fallback)* : Basculement automatique en cas de charge élevée (`gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-3.8-flash`).
- **Intégration Notion** : Insertion automatique des données normalisées (`Client / Projet`, `Synthèse IA`, `Actions à mener`).
- **Interface utilisateur** :
  - Palette sombre ardoise sans contraste agressif.
  - Icônes vectorielles standardisées (Lucide Icons).
  - Restitution du plan d'action sous forme de checklist interactive.
  - Copie instantanée de l'identifiant de page Notion et du résumé.

---

## Architecture Technique

```text
ReportFlow/
├── index.js                     # Point d'entrée Express, configuration Multer & routage API
├── services/
│   ├── geminiService.js         # Client IA, gestion multimodale & stratégie hybride
│   └── notionService.js         # Client REST Notion (Axios) & persistance
├── views/
│   └── index.ejs                # Vue dynamique EJS (Tailwind CSS, Lucide Icons)
├── public/
│   └── js/app.js                # Contrôleur client asynchrone (FormData, Fetch, UX)
└── Documentation/
    ├── README.md                # Documentation principale
    ├── ROADMAP.md               # Feuille de route du projet
    ├── JOURNAL_DE_BORD.md       # Historique des décisions et implémentations
    └── GUIDE_TECHNIQUE_ET_LEXIQUE.md # Manuel technique détaillé
```

### Technologies employées

| Composant | Technologie / Librairie | Rôle |
| :--- | :--- | :--- |
| **Backend** | Node.js, Express 5 | Serveur HTTP et orchestration d'API |
| **Ingestion fichiers** | Multer (`memoryStorage`) | Traitement sécurisé en mémoire vive |
| **Moteur IA** | `@google/genai` (Gemini Flash) | Écoute audio, lecture documentaire et extraction JSON |
| **Extraction Word** | Mammoth | Conversion des fichiers `.docx` en texte brut |
| **Intégration Notion** | Axios, Notion REST API (`2022-06-28`) | Création des fiches dans la base cible |
| **Interface** | EJS, Tailwind CSS, Lucide Icons | Rendu côté serveur et composants d'interaction |

---

## Installation et Démarrage

### Prérequis

* [Node.js](https://nodejs.org/) (version 18 ou supérieure recommandée)
* Une clé d'API Google Gemini ([Google AI Studio](https://aistudio.google.com/))
* Une intégration interne Notion avec accès à votre base de données ([Notion Developers](https://developers.notion.com/))

### 1. Clonage du dépôt

```bash
git clone https://github.com/votre-compte/reportflow.git
cd reportflow
```

### 2. Installation des dépendances

```bash
npm install
```

### 3. Configuration des variables d'environnement

Copiez le modèle d'environnement et complétez vos identifiants :

```bash
cp .env.example .env
```

Contenu requis dans `.env` :

```env
PORT=3000
GEMINI_API_KEY=votre_cle_api_gemini
NOTION_TOKEN=votre_jeton_integration_notion
DATABASE_ID=votre_identifiant_base_notion
```

> [!NOTE]
> Veillez à partager votre base de données Notion avec l'intégration créée dans les paramètres de la page Notion (menu `...` > `Connexions`).

### 4. Lancement de l'application

En mode développement (avec rechargement à chaud via Nodemon) :

```bash
npm run dev
```

En mode production :

```bash
npm start
```

L'application est accessible à l'adresse suivante : `http://localhost:3000`.

---

## Sécurité et Gestion des Données

* **Exclusion des identifiants** : Le fichier `.env` est exclu du suivi Git via `.gitignore`.
* **Traitement en mémoire vive** : Pour les fichiers inférieurs à 20 Mo, aucun binaire n'est écrit sur le disque du serveur hôte.
* **Cycle de vie des fichiers temporaires** : Lors du traitement des fichiers volumineux (≥ 20 Mo), les données temporaires locales (`os.tmpdir()`) et distantes (serveurs Google Files) sont supprimées systématiquement dans un bloc `finally`, garantissant la destruction des données même en cas d'erreur de traitement.

---

## Licence

Ce projet est distribué sous licence MIT. Consultez le fichier [LICENSE](LICENSE) pour plus d'informations.
