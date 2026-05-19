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

  // Force sync depuis Firebase
  document.getElementById('btn-force-sync').addEventListener('click', async () => {
    const btn = document.getElementById('btn-force-sync');
    const status = document.getElementById('sync-status');
    btn.disabled = true;
    btn.textContent = '↻ Synchronisation en cours…';
    status.textContent = '';
    try {
      localStorage.removeItem('_edt_ts');
      await Data._loadFromFirebase();
      showToast('Données mises à jour depuis le cloud !');
      status.textContent = 'Dernière sync : ' + new Date().toLocaleTimeString('fr-FR');
      updateInfo();
    } catch(e) {
      showToast('Échec de la synchronisation.', true);
    }
    btn.disabled = false;
    btn.textContent = '↻ Forcer la sync depuis le cloud';
  });

  // Reset
  document.getElementById('btn-reset-all').addEventListener('click', () => {
    if (!confirm('Effacer TOUTES les données ? Cette action est irréversible.')) return;
    localStorage.removeItem('emploi_du_temps_db');
    localStorage.removeItem('_edt_ts');
    // Supprimer toutes les sauvegardes automatiques
    Object.keys(localStorage)
      .filter(k => k.startsWith('edt_backup_'))
      .forEach(k => localStorage.removeItem(k));
    showToast('Données effacées. Rechargement...');
    setTimeout(() => location.reload(), 800);
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
  if (!confirm(`Restaurer la sauvegarde du ${dateLabel} ?\n\nVos données actuelles seront remplacées.`)) return;
  const result = Data.restoreBackup(date);
  if (result.error) { showToast(result.error, true); return; }
  showToast('Restauration réussie. Rechargement...');
  setTimeout(() => location.reload(), 800);
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
