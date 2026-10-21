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

  // Gestion du dépôt de document (PDF, Word, TXT)
  const dropzone = document.getElementById('dropzone');
  const inputFichier = document.getElementById('input-fichier');
  const fileChip = document.getElementById('file-chip');
  const fileName = document.getElementById('file-name');
  const fileSize = document.getElementById('file-size');
  const btnRemoveFile = document.getElementById('btn-remove-file');
  let selectedFile = null;

  // Conteneurs d'affichage
  const errorBox = document.getElementById('error-box');
  const errorMessage = document.getElementById('error-message');
  const resultPlaceholder = document.getElementById('result-placeholder');
  const resultSkeleton = document.getElementById('result-skeleton');
  const resultContent = document.getElementById('result-content');

  // Champs de restitution
  const notionPageId = document.getElementById('notion-page-id');
  const btnCopyId = document.getElementById('btn-copy-id');
  const copyLabel = document.getElementById('copy-label');
  const btnCopySynthese = document.getElementById('btn-copy-synthese');
  const resClient = document.getElementById('res-client');
  const resSynthese = document.getElementById('res-synthese');
  const resActions = document.getElementById('res-actions');
  const actionsChecklist = document.getElementById('actions-checklist');
  const resJson = document.getElementById('res-json');

  // Éléments d'export Word (.docx) & Google Docs
  const btnTelechargerWord = document.getElementById('btn-telecharger-word');
  const btnTelechargerWordLabel = document.getElementById('btn-telecharger-word-label');
  const iconTelechargerWord = document.getElementById('icon-telecharger-word');
  const spinnerWord = document.getElementById('spinner-word');
  const linkGoogleDocs = document.getElementById('link-google-docs');
  const linkNotionAction = document.getElementById('link-notion-action');
  let dernieresDonnees = null;

  // Initialisation de la librairie d'icônes Lucide
  if (window.lucide) {
    lucide.createIcons();
  }

  // Exemple concret et parlant
  const DEMO_TEXT = `Appel rapide avec la direction de Ravinala Airports cet après-midi.
Ils veulent qu'on réalise une étude d'impact environnemental pour le terminal d'Ivato d'ici décembre.
Le budget prévisionnel est validé mais il faut envoyer la proposition technique avant vendredi prochain et organiser un point avec l'équipe terrain mardi.`;

  // Comptage simple et lisible
  function updateStats() {
    const text = textarea.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;

    charCount.textContent = `${chars} caractère${chars > 1 ? 's' : ''}`;
    wordCount.textContent = `${words} mot${words > 1 ? 's' : ''}`;
  }

  textarea.addEventListener('input', updateStats);

  // Raccourci Ctrl + Entrée
  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  // Action "Exemple" (depuis la barre ou l'illustration)
  function chargerExemple() {
    textarea.value = DEMO_TEXT;
    updateStats();
    textarea.focus();
  }

  btnExemple.addEventListener('click', chargerExemple);
  btnPlaceholderDemo?.addEventListener('click', chargerExemple);

  // Action "Coller"
  btnPaste?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        textarea.value = text;
        updateStats();
        textarea.focus();
      }
    } catch {
      textarea.focus();
    }
  });

  // Action "Effacer"
  btnClear.addEventListener('click', () => {
    textarea.value = '';
    retirerFichier();
    updateStats();
    hideError();
    textarea.focus();
  });

  // ============================================================================
  // Logique du document joint (Drag & Drop + Sélecteur)
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
      showError('Format non pris en charge. Veuillez sélectionner un document (PDF, Word, TXT) ou un enregistrement audio (MP3, M4A, WAV).');
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      showError('Le fichier dépasse la limite autorisée de 200 Mo (jusqu\'à ~2h d\'enregistrement).');
      return;
    }

    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formaterTaille(file.size);

    fileChip.classList.remove('hidden');
    fileChip.classList.add('flex');
    dropzone.classList.add('hidden');
    hideError();
  }

  function retirerFichier() {
    selectedFile = null;
    inputFichier.value = '';
    fileChip.classList.add('hidden');
    fileChip.classList.remove('flex');
    dropzone.classList.remove('hidden');
  }

  dropzone?.addEventListener('click', () => {
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

  // Événements Glisser-Déposer (Drag & Drop)
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone?.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
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
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      assignerFichier(e.dataTransfer.files[0]);
    }
  });

  // ============================================================================
  // Copie rapide
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

  // Construction de la liste des tâches à cocher
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

  // Envoi du formulaire (FormData avec texte et/ou fichier joint)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const notesBrutes = textarea.value.trim();
    if (!notesBrutes && !selectedFile) {
      showError('Veuillez saisir des notes ou joindre un document (PDF, Word ou TXT).');
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

      const data = await response.json();

      if (!response.ok || !data.succes) {
        throw new Error(data.erreur || 'Une erreur est survenue lors du traitement.');
      }

      displayResults(data);
    } catch (err) {
      showError(err.message);
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

  function displayResults({ notionId, donnees, lienDrive }) {
    dernieresDonnees = donnees; // Mémorisation pour l'export Word

    resultSkeleton.classList.add('hidden');
    resultPlaceholder.classList.add('hidden');
    resultContent.classList.remove('hidden');

    notionPageId.textContent = notionId || 'Fiche créée';
    resClient.textContent = donnees.client || 'Client non spécifié';
    resSynthese.textContent = donnees.synthese || 'Aucun résumé disponible.';
    resActions.textContent = donnees.actions || '';
    resJson.textContent = JSON.stringify(donnees, null, 2);

    renderChecklist(donnees.actions);

    // Configuration du lien Google Docs
    if (lienDrive && linkGoogleDocs) {
      linkGoogleDocs.href = lienDrive;
      linkGoogleDocs.classList.remove('hidden');
      linkGoogleDocs.classList.add('inline-flex');
    } else if (linkGoogleDocs) {
      linkGoogleDocs.classList.add('hidden');
      linkGoogleDocs.classList.remove('inline-flex');
    }

    // Configuration du lien direct vers la page Notion spécifique créée
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
  // Téléchargement du Livrable Word (.docx)
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

      // Création du Blob binaire et téléchargement transparent
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
      showError(err.message || 'Une erreur est survenue lors du téléchargement.');
      btnTelechargerWordLabel.textContent = 'Télécharger le rapport';
    } finally {
      spinnerWord.classList.add('hidden');
      iconTelechargerWord.classList.remove('hidden');
      btnTelechargerWord.disabled = false;
    }
  });

  function showError(msg) {
    errorMessage.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  function hideError() {
    errorBox.classList.add('hidden');
    errorMessage.textContent = '';
  }
});
