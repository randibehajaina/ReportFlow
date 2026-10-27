document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-analyse');
  const textarea = document.getElementById('notes-brutes');
  const btnSubmit = document.getElementById('btn-submit');
  const btnIcon = document.getElementById('btn-icon');
  const spinner = document.getElementById('spinner');
  const btnLabel = document.getElementById('btn-label');
  const btnExemple = document.getElementById('btn-exemple');
  const btnPlaceholderDemo = document.getElementById('btn-placeholder-demo');
  const btnPaste = document.getElementById('btn-paste');
  const btnClear = document.getElementById('btn-clear');
  const charCount = document.getElementById('char-count');
  const wordCount = document.getElementById('word-count');

  // Gestion du téléversement de fichiers (PDF, Word, TXT, Audio)
  const dropzone = document.getElementById('dropzone');
  const inputFichier = document.getElementById('input-fichier');
  const fileChip = document.getElementById('file-chip');
  const fileName = document.getElementById('file-name');
  const fileSize = document.getElementById('file-size');
  const btnRemoveFile = document.getElementById('btn-remove-file');
  const bannerFichierActif = document.getElementById('banner-fichier-actif');
  const dropzoneLockedNotice = document.getElementById('dropzone-locked-notice');
  const btnUnlockText = document.getElementById('btn-unlock-text');
  const btnUnlockFile = document.getElementById('btn-unlock-file');
  let selectedFile = null;

  // Conteneurs d'état et d'affichage
  const errorBox = document.getElementById('error-box');
  const errorTitle = document.getElementById('error-title');
  const errorMessage = document.getElementById('error-message');
  const errorTip = document.getElementById('error-tip');
  const errorTipContainer = document.getElementById('error-tip-container');
  const errorIconWrapper = document.getElementById('error-icon-wrapper');
  const errorIconSlot = document.getElementById('error-icon-slot');
  const btnCloseError = document.getElementById('btn-close-error');
  const resultPlaceholder = document.getElementById('result-placeholder');
  const resultSkeleton = document.getElementById('result-skeleton');
  const resultContent = document.getElementById('result-content');

  // Champs de restitution
  const notionPageId = document.getElementById('notion-page-id');
  const btnCopyId = document.getElementById('btn-copy-id');
  const copyLabel = document.getElementById('copy-label');
  const btnCopySynthese = document.getElementById('btn-copy-synthese');
  const resTitre = document.getElementById('res-titre');
  const resProjet = document.getElementById('res-projet');
  const badgeProjet = document.getElementById('badge-projet');
  const resClient = document.getElementById('res-client');
  const badgeClient = document.getElementById('badge-client');
  const resSynthese = document.getElementById('res-synthese');
  const resActions = document.getElementById('res-actions');
  const actionsChecklist = document.getElementById('actions-checklist');
  const resJson = document.getElementById('res-json');

  // Éléments d'exportation documentaire
  const btnTelechargerWord = document.getElementById('btn-telecharger-word');
  const btnTelechargerWordLabel = document.getElementById('btn-telecharger-word-label');
  const iconTelechargerWord = document.getElementById('icon-telecharger-word');
  const spinnerWord = document.getElementById('spinner-word');
  const linkGoogleDocs = document.getElementById('link-google-docs');
  const linkNotionAction = document.getElementById('link-notion-action');
  let dernieresDonnees = null;

  // Initialisation des icônes vectorielles
  if (window.lucide) {
    lucide.createIcons();
  }

  // Jeux d'essai pour démonstration (synchronisés avec les entités Notion de référence)
  const EXEMPLES_NOTES_DEMO = [
    {
      client: "Ravinala Logistique Demo",
      texte: `14 janvier 2026 - Débrief direct après visite du hangar fret
Client : Ravinala Logistique Demo
Projet : Étude de faisabilité d’un entrepôt frigorifique
Présents : Marc (Directeur exploitation), Hery (Responsable logistique piste), moi

Notes en vrac prises sur le carnet :
- Gros souci constaté sur l'entrepôt sous douane zone 3 : saturation presque totale des racks depuis les arrivages de fin d'année (+35% de volume par rapport aux prévisions). Les palettes de vanille et de café en attente d'empotage bloquent les allées de circulation des chariots élévateurs.
- Point critique relevé par Hery : la chambre froide négative n°2 a eu une alerte sonde hier matin (-14°C au lieu de -20°C). Risque de non-conformité sanitaire sur un lot de 4 tonnes de crevettes congelées pour l'export UE. Il faut absolument commander le groupe de condensation de secours. Devis estimé par CFAO / Daikin : 38 500 EUR. Marc veut qu'on challenge le montant d'ici vendredi midi.
- Déclaration douanière anticipée : l'équipe administrative galère avec la nouvelle plateforme Sydonia World. Perte d'au moins 3 heures par vol cargo. Ils demandent si notre système peut automatiser l'injection des manifestes aériens LTA directement en format JSON.
- Prochaine réunion de cadrage technique : calée pour mardi 20 janvier à 14h30 dans leurs locaux à Ivato.

Actions immédiates à suivre :
1. Rédiger et envoyer le mémo comparatif pour la maintenance de la chambre froide avant jeudi 17h.
2. Évaluer la faisabilité technique du connecteur API Sydonia / manifestes fret.
3. Transmettre le plan d'implantation révisé de la zone de stockage temporaire à Marc.
4. Prévoir un point d'étape avec le directeur financier de Ravinala Logistique Demo pour débloquer l'enveloppe budgétaire d'urgence.`
    },
    {
      client: "Commune d’Ambatolampy Demo",
      texte: `Compte-rendu brut séance de travail - 22/01/2026
Client : Commune d’Ambatolampy Demo
Projet : Formation des agents au budget participatif
Participants : M. le Premier Adjoint au Maire, Mme la Directrice des Services Techniques (DST), représentants de l'association des commerçants du marché central, équipe bureau d'études.

Prise de notes au vol pendant les discussions :
- Projet prioritaire de la commune : rénovation d'urgence de la halle couverte du marché d'Ambatolampy et réfection du réseau d'évacuation des eaux pluviales.
- État des lieux dressé par la DST : les buses d'évacuation principales de 600 mm le long de la RN7 sont totalement obstruées par les boues et déchets plastiques. À chaque orage tropical, inondation de 30 cm dans les allées des maraîchers. Travaux de curage mécanique indispensables avant la mi-février.
- Côté budget : subvention validée de 160 millions d'Ariary via le Fonds de Développement Local (FDL). Mais attention : condition suspensive du bailleur imposant le dépôt du dossier de consultation des entreprises (DCE) complet avant le 10 février, sinon les crédits sont réalloués !
- Dialogue avec les commerçants : 85 marchands refusent de quitter leurs étals pendant les travaux si aucune zone de repli n'est aménagée. Solution négociée : découpage en deux phases de 45 jours (d'abord l'aile Ouest, puis l'aile Est) avec installation temporaire sur le terrain vague de l'ancienne gare.
- Éclairage : validation du remplacement des vieux projecteurs halogènes par 18 mâts solaires photovoltaïques autonomes pour sécuriser les arrivages nocturnes de 3h du matin.

To-do list à finaliser :
- Finaliser le Cahier des Clauses Techniques Particulières (CCTP) pour le lot assainissement et terrassement d'ici le 28 janvier.
- Soumettre au maire adjoint le projet de convention d'occupation provisoire pour les commerçants du marché.
- Programmer la visite technique sur site avec l'ingénieur VRD le lundi 26 janvier à 9h00.
- Transmettre le dossier administratif finalisé au secrétariat général de la Commune d’Ambatolampy Demo.`
    },
    {
      client: "Fonds Océan Indien Demo",
      texte: `Call de revue de portefeuille & due diligence - 27/01/2026 (durée : 50 min)
Interlocuteur : Fonds Océan Indien Demo
Projet : Évaluation d’un programme d’énergie solaire
Présents : Patrick (Partner Infrastructure & Énergie), Elena (Directrice ESG), équipe de modélisation financière

Notes brutes de séance :
- Objet : examen final du dossier d'investissement "Centrale Solaire & Stockage Sud". Financement sollicité en dette mezzanine : 2,2 millions USD.
- Données financières : TRI cible actualisé à 13,8% net pour le fonds sur un horizon de 10 ans. La renégociation du tarif de rachat d'électricité (PPA) avec le régulateur a permis de sécuriser un prix plancher de 0,11 USD par kWh sur 15 ans.
- Alerte soulevée par Elena sur le volet ESG et étude d'impact environnemental (EIES) : le tracé de la ligne d'évacuation 33 kV empiète sur une forêt riveraine classée. Exigence de la Banque Mondiale (standard IFC 6) : mener une consultation publique formelle avec les communautés villageoises et prévoir un plan de reboisement compensatoire de 15 hectares.
- Décision du comité : feu vert de principe accordé par le Fonds Océan Indien Demo, mais le déblocage de la tranche 1 (70% du montant) est conditionné à l'obtention du certificat de conformité environnementale avant fin mars 2026.
- Calendrier : signature du protocole d'accord (Term Sheet) envisagée la première semaine de février.

Actions convenues :
1. Réviser le modèle financier sous Excel en intégrant le coût du plan de compensation environnementale (estimé à 45 000 USD).
2. Transmettre le projet de Term Sheet annoté aux juristes du Fonds Océan Indien Demo avant vendredi 30 janvier.
3. Organiser un atelier préparatoire avec le cabinet d'études environnementales le 3 février.
4. Rédiger la note de synthèse exécutive pour transmission aux membres du comité d'investissement.`
    }
  ];

  let dernierIndexDemo = -1;

  // Sélection aléatoire avec rotation sans répétition successive
  function chargerExemple() {
    let indexChoisi;
    if (EXEMPLES_NOTES_DEMO.length > 1) {
      do {
        indexChoisi = Math.floor(Math.random() * EXEMPLES_NOTES_DEMO.length);
      } while (indexChoisi === dernierIndexDemo);
    } else {
      indexChoisi = 0;
    }
    dernierIndexDemo = indexChoisi;
    const exemple = EXEMPLES_NOTES_DEMO[indexChoisi];
    textarea.value = exemple.texte;
    updateStats();
    textarea.focus();
    return exemple;
  }

  // Synchronisation dynamique du verrouillage mutuel (Option B : Texte OU Fichier)
  function synchroniserVerrouillageMutuel() {
    const hasText = textarea.value.trim().length > 0;
    const hasFile = selectedFile !== null;

    if (hasFile) {
      // 1. Mode Fichier actif : verrouillage complet du champ texte
      textarea.readOnly = true;
      textarea.classList.add('opacity-40', 'cursor-not-allowed');
      bannerFichierActif?.classList.remove('hidden');

      btnPaste?.setAttribute('disabled', 'true');
      btnPaste?.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
      btnExemple?.setAttribute('disabled', 'true');
      btnExemple?.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');

      dropzone?.classList.add('hidden');
      dropzoneLockedNotice?.classList.add('hidden');
      fileChip?.classList.remove('hidden');
      fileChip?.classList.add('flex');
    } else if (hasText) {
      // 2. Mode Notes textuelles actif : verrouillage de la zone de dépôt
      textarea.readOnly = false;
      textarea.classList.remove('opacity-40', 'cursor-not-allowed');
      bannerFichierActif?.classList.add('hidden');

      btnPaste?.removeAttribute('disabled');
      btnPaste?.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
      btnExemple?.removeAttribute('disabled');
      btnExemple?.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');

      dropzone?.classList.add('hidden');
      dropzoneLockedNotice?.classList.remove('hidden');
      fileChip?.classList.add('hidden');
      fileChip?.classList.remove('flex');
      if (inputFichier) inputFichier.disabled = true;
    } else {
      // 3. État neutre : les deux canaux sont disponibles
      textarea.readOnly = false;
      textarea.classList.remove('opacity-40', 'cursor-not-allowed');
      bannerFichierActif?.classList.add('hidden');

      btnPaste?.removeAttribute('disabled');
      btnPaste?.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
      btnExemple?.removeAttribute('disabled');
      btnExemple?.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');

      dropzone?.classList.remove('hidden');
      dropzoneLockedNotice?.classList.add('hidden');
      fileChip?.classList.add('hidden');
      fileChip?.classList.remove('flex');
      if (inputFichier) inputFichier.disabled = false;
    }
  }

  // Calcul du nombre de caractères et de mots
  function updateStats() {
    const text = textarea.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;

    charCount.textContent = `${chars} caractère${chars > 1 ? 's' : ''}`;
    wordCount.textContent = `${words} mot${words > 1 ? 's' : ''}`;
  }

  textarea.addEventListener('input', () => {
    updateStats();
    synchroniserVerrouillageMutuel();
    if (errorBox && !errorBox.classList.contains('hidden')) {
      hideError();
    }
  });

  // Raccourci clavier de soumission (Ctrl+Entrée ou Cmd+Entrée)
  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  btnExemple.addEventListener('click', () => {
    if (selectedFile) return;
    chargerExemple();
    synchroniserVerrouillageMutuel();
  });
  btnPlaceholderDemo?.addEventListener('click', () => {
    if (selectedFile) return;
    chargerExemple();
    synchroniserVerrouillageMutuel();
  });

  // Insertion depuis le presse-papier
  btnPaste?.addEventListener('click', async () => {
    if (selectedFile) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        textarea.value = text;
        updateStats();
        synchroniserVerrouillageMutuel();
        textarea.focus();
      }
    } catch {
      textarea.focus();
    }
  });

  // Réinitialisation de la saisie
  btnClear.addEventListener('click', () => {
    textarea.value = '';
    retirerFichier();
    updateStats();
    synchroniserVerrouillageMutuel();
    hideError();
    textarea.focus();
  });

  // Déverrouillage rapide depuis les alertes de notice
  btnUnlockText?.addEventListener('click', () => {
    retirerFichier();
    textarea.focus();
  });

  btnUnlockFile?.addEventListener('click', () => {
    textarea.value = '';
    updateStats();
    synchroniserVerrouillageMutuel();
  });

  // ============================================================================
  // Gestion des pièces jointes (Drag & Drop et sélecteur de fichiers)
  // ============================================================================

  function formaterTaille(octets) {
    if (octets < 1024) return `${octets} o`;
    if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
    return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
  }

  function assignerFichier(file) {
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const formatsAutorises = ['pdf', 'docx', 'txt', 'mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac', 'webm'];

    if (!formatsAutorises.includes(ext) && !file.type.startsWith('audio/')) {
      showError({
        type: 'file',
        titre: 'Format non pris en charge',
        message: 'Ce type de document ou d’audio ne correspond pas aux formats attendus par ReportFlow.',
        conseil: 'Veuillez sélectionner un document (PDF, Word, TXT) ou un enregistrement audio (MP3, M4A, WAV).'
      });
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      showError({
        type: 'file',
        titre: 'Fichier supérieur à 200 Mo',
        message: 'Le fichier sélectionné dépasse la taille limite autorisée de 200 Mo (~2h d’audio).',
        conseil: 'Compressez votre enregistrement audio en MP3 ou raccourcissez-le avant de le déposer.'
      });
      return;
    }

    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formaterTaille(file.size);

    synchroniserVerrouillageMutuel();
    hideError();
  }

  function retirerFichier() {
    selectedFile = null;
    inputFichier.value = '';
    synchroniserVerrouillageMutuel();
  }

  dropzone?.addEventListener('click', () => {
    if (textarea.value.trim().length > 0) return;
    inputFichier.click();
  });

  inputFichier?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      assignerFichier(e.target.files[0]);
    }
  });

  btnRemoveFile?.addEventListener('click', (e) => {
    e.stopPropagation();
    retirerFichier();
  });

  // Événements Drag & Drop (désactivés si des notes textuelles sont saisies)
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone?.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (textarea.value.trim().length > 0) return;
      dropzone.classList.add('border-sky-400', 'bg-[#1e2230]');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone?.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('border-sky-400', 'bg-[#1e2230]');
    });
  });

  dropzone?.addEventListener('drop', (e) => {
    if (textarea.value.trim().length > 0) return;
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      assignerFichier(e.dataTransfer.files[0]);
    }
  });

  // ============================================================================
  // Actions presse-papier
  // ============================================================================

  btnCopyId?.addEventListener('click', async () => {
    const id = notionPageId.textContent.trim();
    if (!id) return;

    try {
      await navigator.clipboard.writeText(id);
      copyLabel.textContent = 'Copié !';
      setTimeout(() => {
        copyLabel.textContent = 'Copier';
      }, 1500);
    } catch {
      // Ignore si refus de permission
    }
  });

  btnCopySynthese?.addEventListener('click', async () => {
    const text = resSynthese.textContent.trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      btnCopySynthese.textContent = 'Copié !';
      setTimeout(() => {
        btnCopySynthese.textContent = 'Copier';
      }, 1500);
    } catch {
      // Ignore si refus de permission
    }
  });

  // Génération de la liste des actions à mener
  function renderChecklist(actionsText) {
    actionsChecklist.innerHTML = '';
    if (!actionsText) {
      actionsChecklist.innerHTML = '<p class="text-xs text-slate-400 italic">Aucune action particulière à faire.</p>';
      return;
    }

    const lines = actionsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    lines.forEach((line) => {
      const cleaned = line.replace(/^[-*•\d.]+\s*/, '');

      const item = document.createElement('label');
      item.className = 'flex items-start space-x-3 p-3 rounded-xl bg-[#15171e] hover:bg-[#1c1e27] border border-[#262934] cursor-pointer transition-colors';

      item.innerHTML = `
        <input type="checkbox" class="action-checkbox mt-0.5 h-4 w-4 rounded border-[#383d4e] bg-[#1a1c24] text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer">
        <span class="text-xs sm:text-sm text-slate-200 leading-relaxed transition-all select-none">${cleaned}</span>
      `;

      actionsChecklist.appendChild(item);
    });
  }

  // Soumission du formulaire (traitement asynchrone multipart/form-data)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const notesBrutes = textarea.value.trim();
    if (!notesBrutes && !selectedFile) {
      showError({ code: 'CONTENU_VIDE' });
      return;
    }

    setLoadingState(true);
    hideError();

    const formData = new FormData();
    if (notesBrutes) {
      formData.append('notesBrutes', notesBrutes);
    }
    if (selectedFile) {
      formData.append('document', selectedFile);
    }

    try {
      const response = await fetch('/api/analyser', {
        method: 'POST',
        body: formData
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        // En cas de réponse inattendue ou de coupure
      }

      if (!response.ok || !data || !data.succes) {
        const errObj = new Error(data?.erreur || `Échec du traitement (${response.status})`);
        errObj.status = response.status;
        errObj.code = data?.code;
        errObj.details = data;
        throw errObj;
      }

      displayResults(data);
    } catch (err) {
      showError(err);
      resultSkeleton.classList.add('hidden');
      resultPlaceholder.classList.remove('hidden');
    } finally {
      setLoadingState(false);
    }
  });

  function setLoadingState(isLoading) {
    btnSubmit.disabled = isLoading;

    if (isLoading) {
      spinner.classList.remove('hidden');
      btnIcon.classList.add('hidden');

      const isAudio = selectedFile && (
        selectedFile.type.startsWith('audio/') || 
        ['mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac', 'webm'].includes(selectedFile.name.split('.').pop().toLowerCase())
      );

      if (isAudio) {
        btnLabel.textContent = "Écoute de l'enregistrement & analyse...";
      } else if (selectedFile) {
        btnLabel.textContent = "Lecture du document & analyse...";
      } else {
        btnLabel.textContent = "Préparation du compte-rendu...";
      }

      resultPlaceholder.classList.add('hidden');
      resultContent.classList.add('hidden');
      resultSkeleton.classList.remove('hidden');
    } else {
      spinner.classList.add('hidden');
      btnIcon.classList.remove('hidden');
      btnLabel.textContent = 'Créer la fiche Notion';
    }
  }

  function displayResults({ notionId, donnees, lienDrive, projetAssocie, clientAssocie }) {
    dernieresDonnees = donnees; // Conservation des données pour l'export

    resultSkeleton.classList.add('hidden');
    resultPlaceholder.classList.add('hidden');
    resultContent.classList.remove('hidden');

    notionPageId.textContent = notionId || 'Fiche créée';
    
    // Titre explicite de la séance
    if (resTitre) {
      resTitre.textContent = donnees.titre || 'Compte-rendu de réunion';
    }

    // Projet Notion
    const projetNom = projetAssocie || donnees.projet || null;
    if (resProjet) {
      resProjet.textContent = projetNom || 'Projet non spécifié';
    }
    if (badgeProjet) {
      if (projetAssocie) {
        badgeProjet.textContent = 'Relié';
        badgeProjet.className = 'shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/50';
      } else if (projetNom) {
        badgeProjet.textContent = 'Non trouvé';
        badgeProjet.className = 'shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/50';
      } else {
        badgeProjet.textContent = 'Non spécifié';
        badgeProjet.className = 'shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
      }
    }

    // Client / Prospect
    const clientNom = clientAssocie || donnees.client || null;
    if (resClient) {
      resClient.textContent = clientNom || 'Client non spécifié';
    }
    if (badgeClient) {
      if (clientAssocie) {
        badgeClient.textContent = 'Relié';
        badgeClient.className = 'shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/50';
      } else if (clientNom) {
        badgeClient.textContent = 'Non trouvé';
        badgeClient.className = 'shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/50';
      } else {
        badgeClient.textContent = 'Non spécifié';
        badgeClient.className = 'shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
      }
    }

    resSynthese.textContent = donnees.synthese || 'Aucun résumé disponible.';
    resActions.textContent = donnees.actions || '';
    resJson.textContent = JSON.stringify(donnees, null, 2);

    renderChecklist(donnees.actions);

    // Mise à jour du lien Google Docs
    if (lienDrive && linkGoogleDocs) {
      linkGoogleDocs.href = lienDrive;
      linkGoogleDocs.classList.remove('hidden');
      linkGoogleDocs.classList.add('inline-flex');
    } else if (linkGoogleDocs) {
      linkGoogleDocs.classList.add('hidden');
      linkGoogleDocs.classList.remove('inline-flex');
    }

    // Mise à jour du lien direct vers la page Notion
    if (notionId && linkNotionAction) {
      const cleanNotionId = String(notionId).replace(/-/g, '');
      linkNotionAction.href = `https://notion.so/${cleanNotionId}`;
      linkNotionAction.classList.remove('hidden');
      linkNotionAction.classList.add('inline-flex');
    } else if (linkNotionAction) {
      linkNotionAction.classList.add('hidden');
      linkNotionAction.classList.remove('inline-flex');
    }

    if (window.innerWidth < 1024) {
      resultContent.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // ============================================================================
  // Export et téléchargement du document Word (.docx)
  // ============================================================================

  btnTelechargerWord?.addEventListener('click', async () => {
    if (!dernieresDonnees) return;

    btnTelechargerWord.disabled = true;
    spinnerWord.classList.remove('hidden');
    iconTelechargerWord.classList.add('hidden');
    btnTelechargerWordLabel.textContent = 'Génération du livrable...';

    try {
      const response = await fetch('/api/generer-word', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dernieresDonnees)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.erreur || 'Échec de la génération du document Word.');
      }

      // Extraction du nom de fichier depuis l'en-tête Content-Disposition ou fallback
      let nomFichier = `Compte-rendu-${(dernieresDonnees.client || 'Projet').trim().replace(/\s+/g, '-')}.docx`;
      const disposition = response.headers.get('content-disposition');
      if (disposition && disposition.includes('filename*=')) {
        const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (match && match[1]) {
          nomFichier = decodeURIComponent(match[1]);
        }
      } else if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/i);
        if (match && match[1]) {
          nomFichier = match[1];
        }
      }

      // Génération du blob binaire et déclenchement du téléchargement
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomFichier;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      btnTelechargerWordLabel.textContent = 'Téléchargé !';
      setTimeout(() => {
        btnTelechargerWordLabel.textContent = 'Télécharger le rapport';
      }, 2500);

    } catch (err) {
      showError(err);
      btnTelechargerWordLabel.textContent = 'Télécharger le rapport';
    } finally {
      spinnerWord.classList.add('hidden');
      iconTelechargerWord.classList.remove('hidden');
      btnTelechargerWord.disabled = false;
    }
  });

  // Masquage du message d'erreur
  btnCloseError?.addEventListener('click', hideError);

  // ============================================================================
  // Traitement et restitution des erreurs applicatives et réseau
  // ============================================================================

  const THEMES_ERREUR = {
    warning: {
      borderClass: 'border-amber-500/40',
      bgClass: 'bg-amber-950/40',
      wrapperClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      titleClass: 'text-amber-100',
      msgClass: 'text-amber-200/90',
      tipBorderClass: 'border-amber-500/20',
      tipClass: 'text-amber-300',
      iconSvg: '<svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
    },
    file: {
      borderClass: 'border-sky-500/40',
      bgClass: 'bg-sky-950/40',
      wrapperClass: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
      titleClass: 'text-sky-100',
      msgClass: 'text-sky-200/90',
      tipBorderClass: 'border-sky-500/20',
      tipClass: 'text-sky-300',
      iconSvg: '<svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
    },
    network: {
      borderClass: 'border-rose-500/40',
      bgClass: 'bg-rose-950/40',
      wrapperClass: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
      titleClass: 'text-rose-100',
      msgClass: 'text-rose-200/90',
      tipBorderClass: 'border-rose-500/20',
      tipClass: 'text-rose-300',
      iconSvg: '<svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>'
    },
    notion: {
      borderClass: 'border-indigo-500/40',
      bgClass: 'bg-indigo-950/40',
      wrapperClass: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
      titleClass: 'text-indigo-100',
      msgClass: 'text-indigo-200/90',
      tipBorderClass: 'border-indigo-500/20',
      tipClass: 'text-indigo-300',
      iconSvg: '<svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>'
    },
    info: {
      borderClass: 'border-slate-700',
      bgClass: 'bg-slate-900',
      wrapperClass: 'bg-slate-800 text-slate-300 border border-slate-700',
      titleClass: 'text-white',
      msgClass: 'text-slate-300',
      tipBorderClass: 'border-slate-800',
      tipClass: 'text-slate-400',
      iconSvg: '<svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    },
    danger: {
      borderClass: 'border-rose-500/40',
      bgClass: 'bg-rose-950/40',
      wrapperClass: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
      titleClass: 'text-rose-100',
      msgClass: 'text-rose-200/90',
      tipBorderClass: 'border-rose-500/20',
      tipClass: 'text-rose-300',
      iconSvg: '<svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
    }
  };

  /**
   * Mappe les statuts et codes d'erreurs en messages explicites pour l'utilisateur.
   */
  function interpreterErreur(errOuMessage, dataJson = {}) {
    // Si l'erreur est déjà un format structuré
    if (errOuMessage && typeof errOuMessage === 'object' && errOuMessage.titre && errOuMessage.message) {
      return errOuMessage;
    }

    const code = errOuMessage?.code || dataJson.code || '';
    const status = errOuMessage?.status || dataJson.status || 0;
    const msgBrut = (
      typeof errOuMessage === 'string'
        ? errOuMessage
        : (errOuMessage?.message || dataJson.erreur || '')
    ).toLowerCase();

    // 1. Défaut de connectivité réseau
    if (!navigator.onLine || msgBrut.includes('failed to fetch') || msgBrut.includes('networkerror') || errOuMessage?.name === 'TypeError') {
      return {
        type: 'network',
        titre: 'Connexion au serveur impossible',
        message: 'Impossible de joindre ReportFlow. Votre connexion Internet est peut-être coupée ou le serveur est temporairement arrêté.',
        conseil: 'Vérifiez votre accès réseau et réessayez. Vos notes restent bien conservées dans l’éditeur.'
      };
    }

    // 2. Dépassement de quota de requêtes (HTTP 429 / Resource Exhausted)
    if (
      code === 'QUOTA_DEPASSE' ||
      status === 429 ||
      msgBrut.includes('429') ||
      msgBrut.includes('quota') ||
      msgBrut.includes('resource_exhausted') ||
      msgBrut.includes('rate limit')
    ) {
      return {
        type: 'warning',
        titre: 'Service temporairement très sollicité (Quota atteint)',
        message: 'La limite de requêtes autorisées a été atteinte auprès de Google AI. Vos données sont précieusement conservées.',
        conseil: 'Patientez environ 60 secondes pour que le quota se réinitialise, puis cliquez à nouveau sur le bouton.'
      };
    }

    // 3. Indisponibilité temporaire du service distant (HTTP 503 / Overloaded)
    if (
      code === 'SERVEUR_OCCUPE' ||
      status === 503 ||
      msgBrut.includes('503') ||
      msgBrut.includes('overloaded') ||
      msgBrut.includes('surchargé')
    ) {
      return {
        type: 'warning',
        titre: 'Serveurs d’analyse occupés',
        message: 'Les serveurs de traitement subissent une forte affluence et n’ont pas pu finaliser la synthèse à cet instant.',
        conseil: 'Attendez 15 à 30 secondes et relancez votre demande.'
      };
    }

    // 4. Dépassement de taille limite de fichier
    if (
      msgBrut.includes('dépasse la taille') ||
      msgBrut.includes('dépasse la limite') ||
      msgBrut.includes('limit_file_size') ||
      msgBrut.includes('200 mo')
    ) {
      return {
        type: 'file',
        titre: 'Fichier supérieur à 200 Mo',
        message: 'Le document ou l’enregistrement audio dépasse le poids maximal autorisé de 200 Mo (~2h d’audio).',
        conseil: 'Compressez votre enregistrement en MP3 ou segmentez la réunion avant de l’envoyer.'
      };
    }

    // 5. Format de fichier non pris en charge
    if (
      msgBrut.includes('format non supporté') ||
      msgBrut.includes('format non pris en charge') ||
      msgBrut.includes('format de fichier non pris en charge')
    ) {
      return {
        type: 'file',
        titre: 'Format de fichier non compatible',
        message: 'Ce type de document ou d’audio ne peut pas être lu par ReportFlow.',
        conseil: 'Formats acceptés : Audio (.mp3, .m4a, .wav), PDF, document Word (.docx) ou texte brut (.txt).'
      };
    }

    // 6. Dépassement de délai de requête (Timeout)
    if (
      code === 'TIMEOUT_RESEAU' ||
      msgBrut.includes('timeout') ||
      msgBrut.includes('econnaborted') ||
      msgBrut.includes('etimedout') ||
      msgBrut.includes('délai')
    ) {
      return {
        type: 'warning',
        titre: 'Latence ou instabilité réseau détectée',
        message: 'La requête vers les serveurs Notion a pris plus de 30 secondes en raison de la latence de votre connexion internet.',
        conseil: 'Le délai de tolérance a été augmenté et vos notes sont conservées. Cliquez à nouveau sur "Analyser et enregistrer".'
      };
    }

    // 7. Anomalie d'intégration Notion (Droits ou schéma)
    if (
      code === 'ERREUR_NOTION' ||
      msgBrut.includes('notion') ||
      msgBrut.includes('database_id')
    ) {
      return {
        type: 'notion',
        titre: 'Enregistrement sur Notion impossible',
        message: 'La synthèse du compte-rendu a bien été générée, mais la création de la fiche dans Notion a échoué.',
        conseil: 'Vérifiez que votre base de données Notion est bien partagée avec l’intégration ReportFlow (H Factory Bot).'
      };
    }

    // 8. Échec d'authentification ou clé API invalide
    if (
      code === 'ERREUR_AUTHENTIFICATION' ||
      status === 401 ||
      status === 403 ||
      msgBrut.includes('api_key') ||
      msgBrut.includes('permission_denied') ||
      msgBrut.includes('authentification')
    ) {
      return {
        type: 'danger',
        titre: 'Accès au service d’IA refusé',
        message: 'La clé de sécurité d’accès à Google Gemini est invalide ou désactivée.',
        conseil: 'Vérifiez la clé API dans la configuration .env ou contactez l’administrateur.'
      };
    }

    // 9. Absence de données en entrée
    if (
      code === 'CONTENU_VIDE' ||
      msgBrut.includes('veuillez saisir') ||
      msgBrut.includes('veuillez fournir') ||
      msgBrut.includes('notes ou déposer')
    ) {
      return {
        type: 'info',
        titre: 'Aucun contenu à analyser',
        message: 'Pour préparer un compte-rendu, vous devez d’abord saisir des notes ou déposer un fichier audio/document.',
        conseil: 'Tapez votre texte ci-dessus ou cliquez sur "Charger un exemple" pour essayer.'
      };
    }

    // 10. Erreur d'exportation documentaire
    if (msgBrut.includes('générer le document word') || msgBrut.includes('données insuffisantes')) {
      return {
        type: 'danger',
        titre: 'Génération du document Word impossible',
        message: 'Les données du compte-rendu sont insuffisantes pour créer le livrable Word.',
        conseil: 'Effectuez d’abord une analyse complète avant de télécharger le rapport.'
      };
    }

    // 11. Erreur générique (fallback)
    return {
      type: 'danger',
      titre: 'L’analyse n’a pas pu aboutir',
      message: 'Un contretemps imprévu est survenu durant le traitement. Vos notes restent bien conservées dans le formulaire.',
      conseil: 'Vous pouvez cliquer à nouveau sur "Créer la fiche Notion" dans un instant pour réessayer.'
    };
  }

  function showError(errOuMessage, dataJson) {
    if (!errorBox) return;

    const info = interpreterErreur(errOuMessage, dataJson);
    const theme = THEMES_ERREUR[info.type] || THEMES_ERREUR.danger;

    // Application des styles visuels associés au type d'erreur
    errorBox.className = `relative p-4 rounded-2xl border transition-all duration-300 shadow-lg text-xs ${theme.bgClass} ${theme.borderClass}`;
    
    if (errorIconWrapper) {
      errorIconWrapper.className = `w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-inner ${theme.wrapperClass}`;
    }
    if (errorIconSlot) {
      errorIconSlot.innerHTML = theme.iconSvg;
    }

    if (errorTitle) {
      errorTitle.className = `font-heading font-semibold text-sm leading-tight ${theme.titleClass}`;
      errorTitle.textContent = info.titre;
    }

    if (errorMessage) {
      errorMessage.className = `text-xs leading-relaxed ${theme.msgClass}`;
      errorMessage.textContent = info.message;
    }

    if (info.conseil && errorTipContainer && errorTip) {
      errorTipContainer.className = `mt-2 pt-2 border-t flex items-start space-x-2 text-[11px] ${theme.tipBorderClass}`;
      errorTip.className = `leading-relaxed ${theme.tipClass}`;
      errorTip.textContent = info.conseil;
      errorTipContainer.classList.remove('hidden');
    } else if (errorTipContainer) {
      errorTipContainer.classList.add('hidden');
      if (errorTip) errorTip.textContent = '';
    }

    errorBox.classList.remove('hidden');

    // Ajustement du défilement si le composant est hors du champ visuel
    try {
      const rect = errorBox.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch { }
  }

  function hideError() {
    if (!errorBox) return;
    errorBox.classList.add('hidden');
    if (errorTitle) errorTitle.textContent = '';
    if (errorMessage) errorMessage.textContent = '';
    if (errorTip) errorTip.textContent = '';
    if (errorTipContainer) errorTipContainer.classList.add('hidden');
  }

  // ============================================================================
  // Gestion de la notice d'information
  // ============================================================================
  const privacyNotice = document.getElementById('demo-privacy-notice');
  const btnDismissPrivacy = document.getElementById('btn-dismiss-privacy');
  const btnTogglePrivacy = document.getElementById('btn-toggle-privacy');

  btnDismissPrivacy?.addEventListener('click', () => {
    if (privacyNotice) {
      privacyNotice.classList.add('hidden');
    }
  });

  // ============================================================================
  // Modal de présentation métier et démonstration
  // ============================================================================
  const modalGuideDemo = document.getElementById('modal-guide-demo');
  const btnOpenGuideHeader = document.getElementById('btn-open-guide-header');
  const btnOpenGuideNotice = document.getElementById('btn-open-guide-notice');
  const btnCloseGuideModal = document.getElementById('btn-close-guide-modal');
  const btnCloseGuideFooter = document.getElementById('btn-close-guide-footer');
  const btnGuideStartTest = document.getElementById('btn-guide-start-test');

  function openGuideModal() {
    if (!modalGuideDemo) return;
    modalGuideDemo.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }

  function closeGuideModal() {
    if (!modalGuideDemo) return;
    modalGuideDemo.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  // Déclencheurs d'ouverture
  btnOpenGuideHeader?.addEventListener('click', openGuideModal);
  btnOpenGuideNotice?.addEventListener('click', openGuideModal);
  btnTogglePrivacy?.addEventListener('click', openGuideModal);

  // Déclencheurs de fermeture
  btnCloseGuideModal?.addEventListener('click', closeGuideModal);
  btnCloseGuideFooter?.addEventListener('click', closeGuideModal);

  // Fermeture par clic sur le fond (backdrop)
  modalGuideDemo?.addEventListener('click', (e) => {
    if (e.target === modalGuideDemo) {
      closeGuideModal();
    }
  });

  // Fermeture via la touche Échap
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalGuideDemo && !modalGuideDemo.classList.contains('hidden')) {
      closeGuideModal();
    }
  });

  // Déclenchement d'un exemple depuis le modal
  btnGuideStartTest?.addEventListener('click', () => {
    closeGuideModal();
    chargerExemple();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});
