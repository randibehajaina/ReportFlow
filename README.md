# ⚡ ReportFlow

> **Transformez vos notes brutes, documents et enregistrements audio de réunions en fiches Notion prêtes à l'action grâce à Google Gemini.**

---

## 🌟 Présentation

**ReportFlow** est une application web conçue pour faire gagner un temps précieux aux professionnels et aux équipes après leurs réunions. Plus besoin de passer des heures à retranscrire ou synthétiser : collez vos notes, déposez un compte-rendu ou glissez directement l'enregistrement audio de la discussion. 

L'intelligence artificielle analyse le contenu de manière multimodale et génère instantanément une fiche structurée directement enregistrée dans votre base de données **Notion**.

---

## ✨ Fonctionnalités Clés

- 🎧 **Prise en charge de l'Audio Longue Durée (jusqu'à 2h)** : Déposez des mémos vocaux ou des réunions complètes (`.mp3`, `.m4a`, `.wav`, etc.) jusqu'à **200 Mo**.
- 📑 **Analyse de Documents Multi-formats** : Traitement direct des comptes-rendus PDF (lecture multimodale native) et Word (`.docx`).
- ✍️ **Saisie de Notes Brutes** : Rédigez ou collez vos brouillons avec compteur de mots/caractères en temps réel.
- 🧠 **Cerveau IA Hybride & Résilient** :
  - **Fichiers < 20 Mo** : Encodage rapide en mémoire RAM (Base64).
  - **Fichiers ≥ 20 Mo** : Transit via l'API Files officielle de Google avec suppression automatique immédiate pour préserver vos quotas et la confidentialité.
  - **Chaîne de secours multi-modèles (Fallback)** : Bascule automatique (`gemini-2.5-flash` ➔ `2.0` ➔ `3.8`) en cas de surcharge des serveurs.
- 🗂️ **Synchronisation Notion Instantanée** : Création automatique d'une page dans votre base de données avec le nom du client, le résumé exécutif et les actions à mener.
- 🎨 **Interface Ergonomique & Apaisante** :
  - Palette ardoise sombre reposante (`#131418` / `#1a1c23`) sans lumière bleue agressive.
  - Vraies icônes vectorielles **Lucide Icons**.
  - Checklist interactive pour cocher vos tâches en direct.
  - Zéro jargon technique : un langage 100% simple et intuitif.

---

## 🛠️ Stack Technique

- **Backend** : Node.js, Express 5, Multer (gestion mémoire vive et transit temporaire sécurisé).
- **IA** : SDK officiel `@google/genai` (Google Gemini Flash).
- **Intégrations** : Notion REST API (via Axios), Mammoth (extraction de texte Word `.docx`).
- **Frontend** : EJS, Tailwind CSS (palette ardoise sur-mesure), Lucide Icons, JavaScript vanilla (Fetch & FormData).

---

## 🚀 Installation & Démarrage

### 1. Prérequis
- [Node.js](https://nodejs.org/) (version 18 ou supérieure recommandée)
- Une clé API Google Gemini ([Google AI Studio](https://aistudio.google.com/))
- Un jeton d'intégration Notion et l'identifiant de votre base de données ([Notion Developers](https://developers.notion.com/))

### 2. Cloner le projet
```bash
git clone https://github.com/votre-nom/reportflow.git
cd reportflow
```

### 3. Installer les dépendances
```bash
npm install
```

### 4. Configurer les variables d'environnement
Créez un fichier `.env` à la racine (en vous basant sur `.env.example`) :
```env
PORT=3000
GEMINI_API_KEY=votre_cle_gemini_ici
NOTION_API_KEY=votre_jeton_integration_notion_ici
NOTION_DATABASE_ID=votre_id_base_de_donnees_notion_ici
```

### 5. Lancer l'application
- En mode développement (avec rechargement automatique) :
  ```bash
  npm run dev
  ```
- En mode production :
  ```bash
  npm start
  ```
Ouvrez votre navigateur sur `http://localhost:3000`.

---

## 🔒 Confidentialité & Sécurité
- Le fichier `.env` est exclu du contrôle de version via `.gitignore`.
- Les fichiers binaires temporaires sont automatiquement détruits du disque et des serveurs Google dès l'analyse terminée.
- Zéro stockage permanent sur le serveur web hôte.

---

## 📄 Licence
Ce projet est sous licence MIT — Développé avec soin par **Behajaina Randimbisoa**.  
Consultez le fichier [LICENSE](LICENSE) pour les termes complets.
