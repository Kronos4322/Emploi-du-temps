// parametres.js — Paramètres & gestion des données
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  updateInfo();
  renderBackups();

  // Paramètres généraux
  const rateInput        = document.getElementById('set-rate');
  const responsableInput = document.getElementById('set-responsable');
  const settings         = Data.getSettings ? Data.getSettings() : {};
  if (settings.defaultBillingRate) rateInput.value = settings.defaultBillingRate;
  if (settings.responsableName)    responsableInput.value = settings.responsableName;

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    if (Data.saveSettings) Data.saveSettings({
      defaultBillingRate: parseFloat(rateInput.value) || 0,
      responsableName:    responsableInput.value.trim(),
    });
    showToast('Paramètres enregistrés.');
  });

  // Informations de facturation
  const siretInput = document.getElementById('set-siret');
  const ibanInput  = document.getElementById('set-iban');
  const bicInput   = document.getElementById('set-bic');
  const delayInput = document.getElementById('set-payment-delay');
  if (settings.siret) siretInput.value = settings.siret;
  if (settings.iban)  ibanInput.value  = settings.iban;
  if (settings.bic)   bicInput.value   = settings.bic;
  if (settings.invoicePaymentDelay) delayInput.value = settings.invoicePaymentDelay;

  const codebanqueInput = document.getElementById('set-codebanque');
  const cleribInput     = document.getElementById('set-clerib');
  const numcompteInput  = document.getElementById('set-numcompte');
  const banknameInput   = document.getElementById('set-bankname');
  if (settings.codebanque) codebanqueInput.value = settings.codebanque;
  if (settings.clerib)     cleribInput.value     = settings.clerib;
  if (settings.numcompte)  numcompteInput.value  = settings.numcompte;
  if (settings.bankname)   banknameInput.value   = settings.bankname;

  document.getElementById('btn-save-invoice-settings').addEventListener('click', () => {
    if (Data.saveSettings) Data.saveSettings({
      siret:      siretInput.value.trim(),
      iban:       ibanInput.value.trim(),
      bic:        bicInput.value.trim(),
      codebanque: codebanqueInput.value.trim(),
      clerib:     cleribInput.value.trim(),
      numcompte:  numcompteInput.value.trim(),
      bankname:   banknameInput.value.trim(),
      invoicePaymentDelay: delayInput.value,
    });
    showToast('Informations de facturation enregistrées.');
  });

  // Export JSON
  document.getElementById('btn-export-json').addEventListener('click', () => {
    const raw  = localStorage.getItem('emploi_du_temps_db') || '{}';
    const blob = new Blob([raw], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `emploi-du-temps-${Utils.currentYearMonth()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Export CSV
  document.getElementById('btn-export-csv').addEventListener('click', () =>
    Data.exportToCsv(Utils.currentYearMonth()));

  // Import JSON
  document.getElementById('input-import').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = Data.importFromJson(ev.target.result);
      if (result.error) {
        showToast(result.error, true);
      } else {
        showToast('Import réussi. Rechargement...');
        setTimeout(() => location.reload(), 800);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Enregistrer & Synchroniser (bouton global en-tête)
  document.getElementById('btn-global-save').addEventListener('click', async () => {
    const btn = document.getElementById('btn-global-save');
    btn.disabled = true;
    btn.textContent = '⏳ Enregistrement…';
    try {
      await Data.forcePushToFirebase();
      showToast('Données enregistrées et synchronisées !');
    } catch(e) {
      showToast('Échec de la synchronisation.', true);
    }
    btn.disabled = false;
    btn.textContent = '💾 Enregistrer & Synchroniser';
  });

  // Récupérer depuis le cloud (pull)
  document.getElementById('btn-force-pull').addEventListener('click', async () => {
    const btn = document.getElementById('btn-force-pull');
    const status = document.getElementById('sync-status');
    btn.disabled = true;
    btn.textContent = '⬇ Récupération en cours…';
    status.textContent = '';
    try {
      localStorage.removeItem('_edt_ts');
      await Data._loadFromFirebase();
      showToast('Données récupérées depuis le cloud !');
      status.textContent = 'Récupéré le ' + new Date().toLocaleTimeString('fr-FR');
      updateInfo();
    } catch(e) {
      showToast('Échec de la récupération.', true);
    }
    btn.disabled = false;
    btn.textContent = '⬇ Récupérer depuis le cloud';
  });

  // Envoyer vers le cloud (push)
  document.getElementById('btn-force-push').addEventListener('click', () => {
    Modals.confirm('Envoyer vos données locales vers le cloud ? Cela remplacera la version cloud par celle de cet appareil.', async () => {
      const btn = document.getElementById('btn-force-push');
      const status = document.getElementById('sync-status');
      btn.disabled = true;
      btn.textContent = '⬆ Envoi en cours…';
      status.textContent = '';
      try {
        await Data.forcePushToFirebase();
        showToast('Données envoyées vers le cloud !');
        status.textContent = 'Envoyé le ' + new Date().toLocaleTimeString('fr-FR');
      } catch(e) {
        showToast('Échec de l\'envoi.', true);
      }
      btn.disabled = false;
      btn.textContent = '⬆ Envoyer mes données vers le cloud';
    }, 'Envoyer', false);
  });

  // Reset
  document.getElementById('btn-reset-all').addEventListener('click', () => {
    Modals.confirm('Effacer TOUTES les données ? Cette action est irréversible.', () => {
      localStorage.removeItem('emploi_du_temps_db');
      localStorage.removeItem('_edt_ts');
      // Supprimer toutes les sauvegardes automatiques
      Object.keys(localStorage)
        .filter(k => k.startsWith('edt_backup_'))
        .forEach(k => localStorage.removeItem(k));
      showToast('Données effacées. Rechargement...');
      setTimeout(() => location.reload(), 800);
    }, 'Effacer définitivement', true);
  });
});

function renderBackups() {
  const backups = Data.getBackups().slice().reverse(); // plus récent en premier
  const container = document.getElementById('backups-list');
  if (backups.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted);font-size:0.9rem">Aucune sauvegarde disponible — une sauvegarde sera créée à la prochaine modification.</p>`;
    return;
  }
  container.innerHTML = backups.map(b => {
    const date    = Utils.formatDateLong(b.date);
    const time    = new Date(b.savedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const sizeKb  = (new Blob([b.data]).size / 1024).toFixed(1);
    const isToday = b.date === Utils.today();
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg);border-radius:8px;border:1px solid var(--border);">
      <div>
        <div style="font-weight:600;font-size:0.95rem">${date} ${isToday ? '<span style="font-size:0.75rem;background:#10b981;color:#fff;border-radius:4px;padding:1px 6px;margin-left:6px">aujourd\'hui</span>' : ''}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">Dernière modif. à ${time} · ${sizeKb} Ko</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="restoreBackup('${b.date}')">↩ Restaurer</button>
    </div>`;
  }).join('');
}

function restoreBackup(date) {
  const dateLabel = Utils.formatDateLong(date);
  Modals.confirm(`Restaurer la sauvegarde du ${dateLabel} ? Vos données actuelles seront remplacées.`, () => {
    const result = Data.restoreBackup(date);
    if (result.error) { showToast(result.error, true); return; }
    showToast('Restauration réussie. Rechargement...');
    setTimeout(() => location.reload(), 800);
  }, 'Restaurer', false);
}

function updateInfo() {
  document.getElementById('info-courses').textContent   = Data.getMissions().length;
  document.getElementById('info-schools').textContent   = Data.getCompanies().length;
  document.getElementById('info-providers').textContent = Data.getProviders().length;
  document.getElementById('info-students').textContent  = Data.getStudents().length;
  document.getElementById('info-formations').textContent = Data.getFormations().length;

  const raw  = localStorage.getItem('emploi_du_temps_db') || '';
  const kb   = (new Blob([raw]).size / 1024).toFixed(1);
  document.getElementById('info-storage').textContent = `${kb} Ko`;
}

function showToast(msg, isError = false) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:8px;
    background:${isError ? '#ef4444' : '#10b981'};color:#fff;font-size:0.9rem;
    box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:9999;transition:opacity .3s`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
}
