// invoice.js — Générateur de facture réutilisable (missions ET oraux HEIP)
'use strict';

const _INV_MONTHS_SH2 = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];

// Résout les infos de la société émettrice (nom, adresse, SIRET, banque…)
window._resolveInvoiceEmitter = function(emetteurId) {
  const ownCos   = Data.getOwnCompanies();
  const settings = Data.getSettings();
  const ourCo    = ownCos.find(c => c.id === emetteurId) || ownCos[0];
  const ourName  = ourCo?.name || settings.responsableName || '';
  const ourAddr  = ourCo?.address || '';
  const ourPhone = ourCo?.phone || '';
  const ourEmail = ourCo?.email || '';
  const _bk = (a,b) => (a!=null && a!=='') ? a : (b||'');
  const _normName = n => (n||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  // SIRET Artémis toujours forcé (indépendant de Firebase)
  const _isArtemis = ourCo && _normName(ourCo.name).includes('artem');
  const siret      = _isArtemis ? '93418651100010' : _bk(ourCo?.siret, settings.siret);
  const iban       = _bk(ourCo?.iban,       settings.iban);
  const bic        = _bk(ourCo?.bic,        settings.bic);
  const codebanque = _bk(ourCo?.codebanque, settings.codebanque);
  const clerib     = _bk(ourCo?.clerib,     settings.clerib);
  const numcompte  = _bk(ourCo?.numcompte,  settings.numcompte);
  const bankname   = _bk(ourCo?.bankname,   settings.bankname);
  const ourLines = [ourAddr, (ourPhone&&ourEmail)?ourEmail+' — '+ourPhone:(ourEmail||ourPhone), siret?'SIRET : '+siret:''].filter(Boolean);
  return { ourCo, ourName, ourAddr, ourPhone, ourEmail, siret, iban, bic, codebanque, clerib, numcompte, bankname, ourLines };
};

// Construit et ouvre le document de facture (fenêtre imprimable).
// opts : { ourName, ourLines, ourAddr, siret, iban, bic, codebanque, clerib, numcompte, bankname,
//          destName, destAddr, destContact, destSiret,
//          invNum, invDateFr, ref, delay, monthName,
//          qtyHeader, rowsHTML, extraFootRow, totalHT }
window._buildInvoiceDocument = function(o) {
  const money = v => Utils.formatMoney(v);
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Facture${o.invNum?' #'+o.invNum:''} — ${o.ourName} — ${o.monthName}</title>
<style>
  @page { size:A4 portrait; margin:9mm 10mm; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:8pt;color:#1e293b;background:#fff;padding:8mm 10mm;width:210mm}
  .no-print{background:#3b82f6;color:#fff;padding:7px 12px;border-radius:5px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;font-size:7.5pt}
  .no-print button{background:#fff;color:#3b82f6;border:none;border-radius:4px;padding:4px 12px;font-weight:700;cursor:pointer}
  .inv-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e293b;padding-bottom:8px;margin-bottom:9px}
  .inv-from .company-name{font-size:13pt;font-weight:800;margin-bottom:2px}
  .inv-from .company-info{font-size:7pt;color:#64748b;line-height:1.5}
  .inv-meta{text-align:right}.inv-word{font-size:20pt;font-weight:800;color:#3b82f6}
  .inv-dates{font-size:7pt;color:#475569;margin-top:4px;line-height:1.5}
  .inv-parties{display:flex;gap:8px;margin-bottom:9px}
  .party{flex:1;background:#f8fafc;border-radius:5px;padding:6px 10px}
  .party-tag{font-size:6pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;margin-bottom:2px}
  .party-name{font-size:8.5pt;font-weight:700;margin-bottom:1px}
  .party-info{font-size:7pt;color:#64748b;line-height:1.4}
  table{width:100%;border-collapse:collapse;margin-bottom:0}
  thead th{background:#1e293b;color:#fff;padding:4px 8px;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;text-align:left}
  thead th.r{text-align:right}
  tbody td{padding:3px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;font-size:8pt;line-height:1.25}
  tbody tr:nth-child(even) td{background:#fafbfc}
  .col-date{width:50px;font-weight:600;white-space:nowrap}.col-qty{width:46px;text-align:right}
  .col-pu{width:62px;text-align:right}.col-tot{width:70px;text-align:right;font-weight:700}
  .school-name{font-size:6.5pt;color:#94a3b8}
  tfoot td{padding:4px 8px}
  .tf-sep td{border-top:1.5px solid #e2e8f0;padding-top:5px}
  .tf-tva{font-size:6.5pt;color:#94a3b8;font-style:italic}
  .tf-ttc td{background:#1e293b;color:#fff;font-weight:700}
  .tf-ttc .col-tot{font-size:10pt}
  .tf-label{text-align:right;color:#64748b;font-size:7.5pt}.tf-label-w{color:#aaa;font-size:7.5pt}
  .inv-footer{margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;font-size:7pt;color:#94a3b8;line-height:1.55}
  @media print{body{padding:0}.no-print{display:none!important}tr{break-inside:avoid}}
</style></head><body>
<div class="no-print">
  <span>📋 Facture${o.invNum?' #'+o.invNum:''} — ${Utils.escapeHtml(o.ourName)} — ${o.monthName}</span>
  <button onclick="window.print()">🖨 Imprimer / Sauvegarder PDF</button>
</div>
<div class="inv-header">
  <div class="inv-from">
    <div class="company-name">${Utils.escapeHtml(o.ourName)}</div>
    <div class="company-info">${o.ourLines.join('<br>')}</div>
  </div>
  <div class="inv-meta">
    <div class="inv-word">FACTURE</div>
    <div class="inv-dates">
      ${o.invNum ? 'N° de facture : <strong>'+o.invNum+'</strong><br>' : ''}
      Date : <strong>${o.invDateFr}</strong><br>
      ${o.ref ? 'Réf client : <strong>'+Utils.escapeHtml(o.ref)+'</strong><br>' : ''}
      Délai : <em>${o.delay} après réception</em>
    </div>
  </div>
</div>
<div class="inv-parties">
  <div class="party">
    <div class="party-tag">De</div>
    <div class="party-name">${Utils.escapeHtml(o.ourName)}</div>
    <div class="party-info">${Utils.escapeHtml(o.ourAddr)}<br>${o.siret?'SIRET : '+o.siret:''}</div>
  </div>
  <div class="party">
    <div class="party-tag">Facturer à</div>
    <div class="party-name">${Utils.escapeHtml(o.destName)}</div>
    <div class="party-info">${o.destAddr?Utils.escapeHtml(o.destAddr)+'<br>':''}${o.destContact?Utils.escapeHtml(o.destContact)+'<br>':''}${o.destSiret?'SIRET : '+Utils.escapeHtml(o.destSiret):''}</div>
  </div>
</div>
<table>
  <thead><tr>
    <th class="col-date">Date</th><th class="col-qty r">${o.qtyHeader || 'Qté (H)'}</th>
    <th>Description</th><th class="col-pu r">P.U. HT</th><th class="col-tot r">Total HT</th>
  </tr></thead>
  <tbody>${o.rowsHTML}</tbody>
  <tfoot>
    ${o.extraFootRow || ''}
    <tr class="${o.extraFootRow ? '' : 'tf-sep'}"><td colspan="3"></td><td class="tf-label">Sous-total HT</td><td class="col-tot">${money(o.totalHT)}</td></tr>
    <tr class="tf-tva"><td colspan="3"></td><td class="tf-label">Exonération TVA</td><td class="col-tot" style="color:#94a3b8">—</td></tr>
    <tr class="tf-ttc"><td colspan="3"></td><td class="tf-label-w">TOTAL TTC À PAYER</td><td class="col-tot">${money(o.totalHT)}</td></tr>
  </tfoot>
</table>
${(o.iban||o.codebanque) ? '<div class="inv-footer"><strong>Coordonnées bancaires :</strong><br>'+(o.iban?'IBAN : '+o.iban+'<br>':'')+(o.codebanque?'CODE BANQUE : '+o.codebanque+'  —  CLÉ RIB : '+o.clerib+'  —  N° COMPTE : '+o.numcompte+'<br>':'')+(o.bic?'BIC : '+o.bic+'<br>':'')+(o.bankname?o.bankname+'<br>':'')+'<br>TVA non applicable — article 293 B du CGI  |  Délais de paiement : '+(o.delay||'45 jours')+' après réception</div>' : '<div class="inv-footer">TVA non applicable — article 293 B du CGI  |  Délais de paiement : '+(o.delay||'45 jours')+' après réception</div>'}
</body></html>`;

  if (typeof Modals !== 'undefined' && Modals.close) Modals.close();
  const w = window.open('', '_blank', 'width=900,height=750');
  if (!w) { Utils.toast('Autorisez les pop-ups pour ce site.', 'error'); return; }
  w.document.write(html);
  w.document.close();
};
