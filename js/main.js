// ---- ユーティリティ ----
function pad(n) { return String(n).padStart(2, '0'); }
function fmtTime(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function minutesToHM(m) {
  const h = Math.floor(Math.abs(m) / 60);
  const min = Math.abs(m) % 60;
  return min === 0 ? `${m < 0 ? '-' : ''}${h}` : `${m < 0 ? '-' : ''}${h}:${pad(min)}`;
}
function minutesToHMFull(m) {
  const h = Math.floor(Math.abs(m) / 60);
  const min = Math.abs(m) % 60;
  return `${m < 0 ? '-' : ''}${h}:${pad(min)}`;
}
function minutesToHMShort(m) { return minutesToHM(m); }
function minutesToH(m) { return (m / 60).toFixed(1); }
function dowSpan(dow) {
  const c = dow === '日' ? '#e53e3e' : dow === '土' ? '#3182ce' : '';
  return c ? `(<span style="color:${c}">${dow}</span>)` : `(${dow})`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
// ym = "2026-04" 形式。省略時はデフォルト時給を使用
function calcWage(mins, ym) {
  const rate = ym ? DB.getRate(ym) : DB.hourlyRate;
  if (!rate || mins <= 0) return null;
  const OVERTIME_THRESHOLD = 480; // 8時間 = 480分
  const normalMins = Math.min(mins, OVERTIME_THRESHOLD);
  const overMins   = Math.max(0, mins - OVERTIME_THRESHOLD);
  return Math.floor(normalMins / 60 * rate + overMins / 60 * rate * 1.25);
}
function fmtWage(yen) {
  if (yen === null) return '-';
  return '¥' + yen.toLocaleString();
}
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// ---- 時計 ----
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = fmtTime(now);
  document.getElementById('today-date').textContent =
    `${now.getMonth()+1}月${now.getDate()}日 (${['日','月','火','水','木','金','土'][now.getDay()]})`;
}
setInterval(updateClock, 1000);
updateClock();

// ---- タブ切替 ----
function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'weekly') renderWeekly();
  if (name === 'leave') renderLeave();
  if (name === 'summary') renderSummary();
  if (name === 'annual') renderAnnual();
}

// ---- 時給設定 ----
function saveWage() {
  const val = parseInt(document.getElementById('hourly-rate').value) || 0;
  DB.hourlyRate = val;
  SYNC.push();
  updateWageDisplay();
  renderPunchRecords();
}

function updateWageDisplay() {
  const rate = DB.hourlyRate;
  const disp = document.getElementById('wage-display');
  if (rate) {
    const normal = fmtWage(rate * 8);
    const over1h = fmtWage(Math.floor(rate * 1.25));
    disp.textContent = `8h勤務: ${normal}　残業1hあたり: ${over1h}`;
  } else {
    disp.textContent = '';
  }
  renderMonthlyRatesList();
}

// ---- 月別時給 ----
function saveMonthlyRate() {
  const month = document.getElementById('wage-month').value;  // "2026-04"
  const rate  = parseInt(document.getElementById('wage-month-rate').value) || 0;
  if (!month) { showToast('月を選択してください'); return; }
  const rates = DB.hourlyRates;
  if (rate) {
    rates[month] = rate;
  } else {
    delete rates[month]; // 0または空欄で削除
  }
  DB.hourlyRates = rates;
  SYNC.push();
  document.getElementById('wage-month-rate').value = '';
  renderMonthlyRatesList();
  renderPunchRecords();
  showToast(rate ? `${month} の時給を ¥${rate.toLocaleString()} に設定しました` : `${month} の月別設定を削除しました`);
}

function deleteMonthlyRate(month) {
  const rates = DB.hourlyRates;
  delete rates[month];
  DB.hourlyRates = rates;
  SYNC.push();
  renderMonthlyRatesList();
  renderPunchRecords();
  showToast(`${month} の月別設定を削除しました`);
}

// ---- 交通費設定 ----
function saveTransportFee() {
  const val = parseInt(document.getElementById('transport-fee').value) || 0;
  DB.transportFee = val;
  SYNC.push();
  updateTransportDisplay();
  renderSummary();
  renderAnnual();
}

function updateTransportDisplay() {
  const fee = DB.transportFee;
  const disp = document.getElementById('transport-display');
  if (disp) disp.textContent = fee ? `20日出勤の場合: ${fmtWage(fee * 20)}` : '';
}

function renderMonthlyRatesList() {
  const container = document.getElementById('monthly-rates-list');
  if (!container) return;
  const rates = DB.hourlyRates;
  const entries = Object.entries(rates).sort((a, b) => b[0].localeCompare(a[0]));
  if (!entries.length) {
    container.innerHTML = '<div style="font-size:12px;color:#a0aec0">月別設定なし（基本時給を使用）</div>';
    return;
  }
  container.innerHTML = entries.map(([ym, rate]) => {
    const [y, m] = ym.split('-');
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f4f8;font-size:13px">
      <span style="font-weight:600;color:#1a202c">${y}年${parseInt(m)}月</span>
      <span style="color:#4a5568">¥${rate.toLocaleString()} / 時間</span>
      <button onclick="deleteMonthlyRate('${ym}')" style="padding:3px 8px;background:#fff5f5;border:1px solid #fc8181;color:#1a202c;border-radius:6px;font-size:11px;cursor:pointer">削除</button>
    </div>`;
  }).join('');
}

// ---- クラウド同期 UI ----
function updateSyncUI() {
  const setup   = document.getElementById('sync-setup');
  const actions = document.getElementById('sync-actions');
  if (!setup || !actions) return;
  if (SYNC.key) {
    setup.style.display   = 'none';
    actions.style.display = 'flex';
    const inp = document.getElementById('jb-key-input');
    if (inp) inp.value = SYNC.key;
  } else {
    setup.style.display   = 'flex';
    actions.style.display = 'none';
  }
  // 共有コードエリアを閉じておく
  const sc = document.getElementById('share-code-area');
  if (sc) sc.style.display = 'none';
}

async function saveJbKey() {
  const key = document.getElementById('jb-key-input').value.trim();
  if (!key) { showToast('APIキーを入力してください'); return; }
  // ⚠️ 同期前にバックアップを強く推奨
  const hasPunches = DB.punches.length > 0 || DB.shifts.length > 0;
  if (hasPunches) {
    const ok = confirm('⚠️ 同期を設定する前に必ずバックアップを作成してください。\n\n「キャンセル」でバックアップ画面へ戻る\n「OK」でそのまま同期設定を続ける');
    if (!ok) return;
  }
  SYNC.key = key;
  SYNC.bin = ''; // binをリセットして次回自動作成
  updateSyncUI();
  // すぐ同期を試みる（新規Gist作成→現在のデータをアップロード）
  await syncNow();
}

function resetSync() {
  if (!confirm('同期設定を解除しますか？\nローカルのデータは残ります。')) return;
  localStorage.removeItem('wt_jb_key');
  localStorage.removeItem('wt_jb_bin');
  updateSyncUI();
  showToast('同期設定を解除しました');
}

function showShareCode() {
  const area = document.getElementById('share-code-area');
  const code = btoa(JSON.stringify({ key: SYNC.key, bin: SYNC.bin }));
  document.getElementById('share-code-text').textContent = code;
  area.style.display = area.style.display === 'none' ? 'block' : 'none';
}

function copyShareCode() {
  const text = document.getElementById('share-code-text').textContent;
  navigator.clipboard.writeText(text).then(() => showToast('共有コードをコピーしました'));
}

function applyShareCode() {
  const raw = document.getElementById('share-code-input').value.trim();
  try {
    const { key, bin } = JSON.parse(atob(raw));
    if (!key) throw new Error('invalid');
    SYNC.key = key;
    SYNC.bin = bin || '';
    document.getElementById('share-code-input').value = '';
    updateSyncUI();
    showToast('共有コードを適用しました。同期中...');
    syncNow();
  } catch(e) {
    showToast('共有コードが正しくありません');
  }
}

async function syncNow() {
  const status = document.getElementById('sync-status');
  if (status) status.textContent = '⏳ 同期中...';
  // bin作成を試みる
  if (!SYNC.bin) {
    const created = await SYNC.ensureBin();
    if (!created) {
      if (status) status.innerHTML = '❌ Gist作成失敗<br><span style="font-size:11px">トークンの権限（gist）を確認してください</span>';
      return;
    }
  }
  // 新規作成直後はpullせず（空データで上書きを防ぐ）、pushのみ
  if (SYNC._justCreated) {
    SYNC._justCreated = false;
    await SYNC.push();
    if (status) status.textContent = '✅ 同期完了（新規）' + new Date().toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit'});
    showToast('Gistを作成してデータをアップロードしました');
    return;
  }
  const ok = await SYNC.pull();
  if (ok) {
    if (status) status.textContent = '✅ 同期完了 ' + new Date().toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit'});
    refreshPunchUI();
    renderShiftList();
    renderSummary();
    renderAnnual();
    showToast('同期完了しました');
  } else {
    if (status) status.innerHTML = '❌ 同期失敗<br><span style="font-size:11px">APIキーかネット接続を確認してください</span>';
  }
}

// ---- 自動バックアップ ----
const AUTO_BACKUP_PREFIX = 'wt_autobackup_';
const AUTO_BACKUP_DAYS   = 7;

function saveAutoBackup() {
  const today = todayStr();
  const data = JSON.stringify({
    savedAt: new Date().toISOString(),
    punches: DB.punches, shifts: DB.shifts,
    hourlyRate: DB.hourlyRate, hourlyRates: DB.hourlyRates,
    transportFee: DB.transportFee, hireDate: DB.hireDate, leaveUsed: DB.leaveUsed,
  });
  localStorage.setItem(AUTO_BACKUP_PREFIX + today, data);
  // 古いバックアップを削除（7日より前）
  const keys = Object.keys(localStorage).filter(k => k.startsWith(AUTO_BACKUP_PREFIX));
  keys.sort().reverse().slice(AUTO_BACKUP_DAYS).forEach(k => localStorage.removeItem(k));
  renderAutoBackupList();
}

function renderAutoBackupList() {
  const container = document.getElementById('auto-backup-list');
  if (!container) return;
  const keys = Object.keys(localStorage)
    .filter(k => k.startsWith(AUTO_BACKUP_PREFIX))
    .sort().reverse();
  if (!keys.length) {
    container.innerHTML = '<div style="font-size:12px;color:#a0aec0">まだ自動バックアップがありません</div>';
    return;
  }
  container.innerHTML = keys.map(k => {
    const date = k.replace(AUTO_BACKUP_PREFIX, '');
    const d = JSON.parse(localStorage.getItem(k));
    const count = (d.punches?.length || 0) + (d.shifts?.length || 0);
    const isToday = date === todayStr();
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#f7fafc;border-radius:8px;border:1px solid #e2e8f0">
      <div>
        <span style="font-size:13px;font-weight:600;color:#1a202c">${date}${isToday ? ' <span style="font-size:10px;color:#AA0000">今日</span>' : ''}</span>
        <span style="font-size:11px;color:#718096;margin-left:8px">${count}件のデータ</span>
      </div>
      <button onclick="restoreAutoBackup('${k}')" style="padding:5px 12px;background:#fff0f0;border:1px solid #fc8181;color:#AA0000;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">復元</button>
    </div>`;
  }).join('');
}

function restoreAutoBackup(key) {
  if (!confirm(`${key.replace(AUTO_BACKUP_PREFIX,'')} のバックアップから復元しますか？\n現在のデータは上書きされます。`)) return;
  const d = JSON.parse(localStorage.getItem(key));
  if (!d) { showToast('バックアップが見つかりません'); return; }
  if (Array.isArray(d.punches))  DB.punches  = d.punches;
  if (Array.isArray(d.shifts))   DB.shifts   = d.shifts;
  if (d.hourlyRate !== undefined) DB.hourlyRate   = d.hourlyRate;
  if (d.hourlyRates) DB.hourlyRates = d.hourlyRates;
  if (d.transportFee !== undefined) DB.transportFee = d.transportFee;
  if (d.hireDate)    DB.hireDate   = d.hireDate;
  if (Array.isArray(d.leaveUsed)) DB.leaveUsed = d.leaveUsed;
  SYNC.push();
  refreshPunchUI();
  renderShiftList();
  renderSummary();
  renderAnnual();
  showToast('自動バックアップから復元しました');
  document.getElementById('backup-status').textContent = `✅ ${key.replace(AUTO_BACKUP_PREFIX,'')} のバックアップから復元しました`;
}

// ---- バックアップ・復元 ----
function exportBackup() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    punches:      DB.punches,
    shifts:       DB.shifts,
    hourlyRate:   DB.hourlyRate,
    hourlyRates:  DB.hourlyRates,
    transportFee: DB.transportFee,
    hireDate:     DB.hireDate,
    leaveUsed:    DB.leaveUsed,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kinmu-backup-${todayStr()}.json`;
  a.click();
  document.getElementById('backup-status').textContent = `✅ ${todayStr()} のバックアップを作成しました`;
  showToast('バックアップファイルをダウンロードしました');
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.punches && !data.shifts) throw new Error('invalid format');
      if (!confirm(`バックアップ（${data.exportedAt ? new Date(data.exportedAt).toLocaleString('ja-JP') : '日時不明'}）を復元しますか？\n現在のデータは上書きされます。`)) {
        event.target.value = '';
        return;
      }
      if (Array.isArray(data.punches))  DB.punches      = data.punches;
      if (Array.isArray(data.shifts))   DB.shifts       = data.shifts;
      if (data.hourlyRate !== undefined) DB.hourlyRate   = data.hourlyRate;
      if (data.hourlyRates)             DB.hourlyRates  = data.hourlyRates;
      if (data.transportFee !== undefined) DB.transportFee = data.transportFee;
      // UI更新
      const savedRate = DB.hourlyRate;
      if (savedRate) document.getElementById('hourly-rate').value = savedRate;
      const savedTrans = DB.transportFee;
      if (savedTrans) document.getElementById('transport-fee').value = savedTrans;
      updateWageDisplay();
      updateTransportDisplay();
      renderMonthlyRatesList();
      refreshPunchUI();
      renderShiftList();
      SYNC.push();
      document.getElementById('backup-status').textContent = '✅ データを復元しました';
      showToast('データを復元しました');
    } catch(err) {
      document.getElementById('backup-status').textContent = '❌ ファイルの形式が正しくありません';
      showToast('復元に失敗しました');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ---- 打刻 ----
function getTodayPunch() {
  return DB.punches.find(p => p.date === todayStr());
}

function refreshPunchUI() {
  const punch = getTodayPunch();
  const btnIn = document.getElementById('btn-in');
  const btnOut = document.getElementById('btn-out');
  const status = document.getElementById('punch-status');
  if (!punch) {
    btnIn.disabled = false; btnOut.disabled = true;
    status.innerHTML = '本日の打刻はまだありません';
  } else if (punch.in && !punch.out) {
    btnIn.disabled = true; btnOut.disabled = false;
    status.innerHTML = `出勤打刻済み: <span>${punch.in}</span>`;
  } else {
    btnIn.disabled = true; btnOut.disabled = true;
    const mins = calcPunchMinutes(punch);
    const wage = calcWage(mins, punch.date.substring(0, 7));
    status.innerHTML = `出勤 <span>${punch.in}</span> → 退勤 <span>${punch.out}</span>　実働 <span>${minutesToHM(mins)}</span>${wage !== null ? `　給与 <span>${fmtWage(wage)}</span>` : ''}`;
  }
  renderPunchRecords();
}

function calcPunchMinutes(punch) {
  if (!punch.in || !punch.out) return 0;
  const [ih, im] = punch.in.split(':').map(Number);
  const [oh, om] = punch.out.split(':').map(Number);
  let mins = (oh * 60 + om) - (ih * 60 + im);
  // 休憩時間を差し引く
  if (punch.breakIn && punch.breakOut) {
    const [bih, bim] = punch.breakIn.split(':').map(Number);
    const [boh, bom] = punch.breakOut.split(':').map(Number);
    const breakMins = (boh * 60 + bom) - (bih * 60 + bim);
    if (breakMins > 0) mins -= breakMins;
  }
  return Math.max(0, mins);
}

function punchIn() {
  const now = new Date();
  const today = todayStr();
  const punches = DB.punches;
  if (punches.find(p => p.date === today)) return;
  punches.push({ date: today, in: fmtTime(now), out: null });
  DB.punches = punches;
  SYNC.push();
  saveAutoBackup();
  showToast(`出勤打刻: ${fmtTime(now)}`);
  refreshPunchUI();
}

function punchOut() {
  const now = new Date();
  const today = todayStr();
  const punches = DB.punches;
  const punch = punches.find(p => p.date === today);
  if (!punch || punch.out) return;
  punch.out = fmtTime(now);
  DB.punches = punches;
  SYNC.push();
  saveAutoBackup();
  showToast(`退勤打刻: ${fmtTime(now)}`);
  refreshPunchUI();
}

function deletePunch(date) {
  if (!confirm(`${date} の打刻を削除しますか？`)) return;
  DB.punches = DB.punches.filter(p => p.date !== date);
  SYNC.push();
  refreshPunchUI();
  showToast('削除しました');
}

// ---- 打刻の編集 ----
let editingDate = null;

function startEditPunch(date) {
  editingDate = date;
  renderPunchRecords();
}

function cancelEditPunch() {
  editingDate = null;
  renderPunchRecords();
}

function saveEditPunch(date) {
  const newDate    = document.getElementById(`edit-date-${date}`).value;
  const newIn      = document.getElementById(`edit-in-${date}`).value;
  const newOut     = document.getElementById(`edit-out-${date}`).value;
  const newBreakIn = document.getElementById(`edit-break-in-${date}`).value;
  const newBreakOut= document.getElementById(`edit-break-out-${date}`).value;
  if (!newDate) { showToast('日付を入力してください'); return; }
  if (!newIn) { showToast('出勤時刻を入力してください'); return; }
  if (newOut) {
    const [ih, im] = newIn.split(':').map(Number);
    const [oh, om] = newOut.split(':').map(Number);
    if ((oh * 60 + om) <= (ih * 60 + im)) { showToast('退勤は出勤より後にしてください'); return; }
  }
  // 休憩バリデーション
  if (newBreakIn || newBreakOut) {
    if (!newBreakIn || !newBreakOut) { showToast('休憩入りと終わりの両方を入力してください'); return; }
    const [bih, bim] = newBreakIn.split(':').map(Number);
    const [boh, bom] = newBreakOut.split(':').map(Number);
    if ((boh * 60 + bom) <= (bih * 60 + bim)) { showToast('休憩終わりは入りより後にしてください'); return; }
  }
  const punches = DB.punches;
  const punch = punches.find(p => p.date === date);
  if (!punch) return;
  // 日付が変わる場合、同じ日付のレコードが既にあれば弾く
  if (newDate !== date && punches.some(p => p.date === newDate)) {
    showToast('その日付の打刻は既に存在します'); return;
  }
  punch.date     = newDate;
  punch.in       = newIn;
  punch.out      = newOut || null;
  punch.breakIn  = newBreakIn  || null;
  punch.breakOut = newBreakOut || null;
  // 日付順に並び替え
  punches.sort((a, b) => a.date < b.date ? 1 : -1);
  DB.punches = punches;
  SYNC.push();
  editingDate = null;
  showToast('打刻を更新しました');
  refreshPunchUI();
}

function renderPunchRecords() {
  const container = document.getElementById('punch-records-container');
  const ym = document.getElementById('punch-month')?.value || '';
  const allPunches = [...DB.punches].sort((a, b) => a.date.localeCompare(b.date));
  const punches = ym ? allPunches.filter(p => p.date.startsWith(ym)) : allPunches;
  if (!punches.length) { container.innerHTML = '<p class="empty-msg">記録がありません</p>'; return; }

  const hasWage = DB.hourlyRate > 0 || Object.keys(DB.hourlyRates).length > 0;
  let html = `<table><thead><tr><th>日付</th><th>出勤</th><th>退勤</th><th>休憩</th><th>実働</th>${hasWage ? '<th>給与</th>' : ''}<th></th></tr></thead><tbody>`;

  for (const p of punches) {
    const mins = calcPunchMinutes(p);
    const [y, m, d] = p.date.split('-');
    const dow = ['日','月','火','水','木','金','土'][new Date(p.date).getDay()];
    const dateStr = `${parseInt(m)}/${parseInt(d)}${dowSpan(dow)}`;
    const ym = `${y}-${m}`;
    const wage = calcWage(mins, ym);

    if (editingDate === p.date) {
      const colSpan = hasWage ? 6 : 5;
      html += `<tr class="edit-row">
        <td colspan="${colSpan}" style="padding:8px 6px">
          <div style="display:flex;gap:8px;align-items:stretch">
            <div style="flex:1;display:flex;flex-direction:column;gap:6px;min-width:0">
              <div style="display:flex;gap:6px;align-items:center">
                <span style="font-size:11px;color:#718096;width:16px;flex-shrink:0">日</span>
                <input class="time-input" type="date" id="edit-date-${p.date}" value="${p.date}" style="flex:1;min-width:0;width:auto">
              </div>
              <div style="display:flex;gap:6px;align-items:center">
                <span style="font-size:11px;color:#718096;width:16px;flex-shrink:0">出</span>
                <input class="time-input" type="time" id="edit-in-${p.date}" value="${p.in ?? ''}" style="flex:1;min-width:0">
                <span style="font-size:11px;color:#718096;width:16px;flex-shrink:0;text-align:center">退</span>
                <input class="time-input" type="time" id="edit-out-${p.date}" value="${p.out ?? ''}" style="flex:1;min-width:0">
              </div>
              <div style="display:flex;gap:6px;align-items:center">
                <span style="font-size:11px;color:#718096;width:16px;flex-shrink:0">休</span>
                <input class="time-input" type="time" id="edit-break-in-${p.date}" value="${p.breakIn ?? ''}" style="flex:1;min-width:0">
                <span style="font-size:11px;color:#718096;width:16px;flex-shrink:0;text-align:center">〜</span>
                <input class="time-input" type="time" id="edit-break-out-${p.date}" value="${p.breakOut ?? ''}" style="flex:1;min-width:0">
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;justify-content:center">
              <button class="btn-sm btn-save" onclick="saveEditPunch('${p.date}')" style="padding:8px 14px;font-size:13px">保存</button>
              <button class="btn-sm btn-danger" onclick="deletePunch('${p.date}')" style="padding:8px 14px;font-size:13px">削除</button>
            </div>
          </div>
        </td>
      </tr>`;
    } else {
      const timeBadge = p.out
        ? `<span class="badge badge-blue">${minutesToHM(mins)}</span>`
        : `<span class="badge badge-green">勤務中</span>`;
      // 休憩表示
      let breakStr = '-';
      if (p.breakIn && p.breakOut) {
        const [bih, bim] = p.breakIn.split(':').map(Number);
        const [boh, bom] = p.breakOut.split(':').map(Number);
        const bMins = (boh * 60 + bom) - (bih * 60 + bim);
        breakStr = `<span style="font-size:11px">${p.breakIn}〜${p.breakOut}<br><span style="color:#718096">${bMins}分</span></span>`;
      }
      html += `<tr>
        <td>${dateStr}</td>
        <td>${p.in ?? '-'}</td>
        <td>${p.out ?? '-'}</td>
        <td>${breakStr}</td>
        <td>${timeBadge}</td>
        ${hasWage ? `<td>${wage !== null ? '<span class="wage-chip">'+fmtWage(wage)+'</span>' : '-'}</td>` : ''}
        <td>
          <button class="btn-sm btn-edit" onclick="startEditPunch('${p.date}')">編集</button>
        </td>
      </tr>`;
    }
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ---- シフト ----
// 時刻セレクトのオプション生成（0〜23時）
(function initShiftSelects() {
  const startSel = document.getElementById('shift-start');
  const endSel   = document.getElementById('shift-end');
  // 開始: 9〜18時
  for (let h = 9; h <= 18; h++) {
    const opt = document.createElement('option');
    opt.value = h; opt.textContent = `${h}:00`;
    startSel.appendChild(opt);
  }
  // 終了: 12〜21時
  for (let h = 12; h <= 21; h++) {
    const opt = document.createElement('option');
    opt.value = h; opt.textContent = `${h}:00`;
    endSel.appendChild(opt);
  }
  // デフォルト値
  document.getElementById('shift-start').value = 9;
  document.getElementById('shift-end').value   = 15;
})();

function autoFillBreak() {
  const sh = parseInt(document.getElementById('shift-start').value);
  const eh = parseInt(document.getElementById('shift-end').value);
  if (isNaN(sh) || isNaN(eh)) return;
  const diff = eh - sh;
  document.getElementById('shift-break').value = diff >= 7 ? 60 : 0;
}

function addShift() {
  const date   = document.getElementById('shift-date').value;
  const startH = document.getElementById('shift-start').value;
  const endH   = document.getElementById('shift-end').value;
  const memo   = document.getElementById('shift-memo').value.trim();
  if (!date || startH === '' || endH === '') { showToast('日付・開始・終了を入力してください'); return; }
  const sh = parseInt(startH);
  const eh = parseInt(endH);
  if (isNaN(sh) || isNaN(eh)) { showToast('時間を正しく入力してください'); return; }
  const start = `${pad(sh)}:00`;
  const end   = `${pad(eh)}:00`;
  const totalMins = (eh * 60) - (sh * 60);
  if (totalMins <= 0) { showToast('終了は開始より後にしてください'); return; }
  // 7時間以上→60分休憩、未満→0分（保存時に直接計算）
  const brk = totalMins >= 420 ? 60 : 0;
  const workMins = totalMins - brk;
  const shifts = DB.shifts;
  shifts.push({ id: Date.now(), date, start, end, break: brk, work: workMins, memo });
  DB.shifts = shifts;
  SYNC.push();
  saveAutoBackup();
  autoCalcWeeklyDays();
  showToast('シフトを追加しました');
  document.getElementById('shift-start').value = 9;
  document.getElementById('shift-end').value   = 15;
  document.getElementById('shift-memo').value  = '';
  renderShiftList();
}

function deleteShift(id) {
  if (!confirm('このシフトを削除しますか？')) return;
  DB.shifts = DB.shifts.filter(s => s.id !== id);
  SYNC.push();
  autoCalcWeeklyDays();
  renderShiftList();
  showToast('削除しました');
}

function renderShiftList() {
  const container = document.getElementById('shift-list-container');
  const ym = document.getElementById('shift-month')?.value || '';
  const allShifts = [...DB.shifts].sort((a, b) => a.date.localeCompare(b.date));
  const shifts = ym ? allShifts.filter(s => s.date.startsWith(ym)) : allShifts;
  if (!shifts.length) { container.innerHTML = '<p class="empty-msg">シフトがありません</p>'; return; }
  const DOWS = ['日','月','火','水','木','金','土'];
  let html = `<table><thead><tr><th>日付</th><th>開始</th><th>終了</th><th>休憩</th><th></th></tr></thead><tbody>`;
  for (const s of shifts) {
    const [y, m, d] = s.date.split('-');
    const dow = DOWS[new Date(s.date).getDay()];
    html += `<tr>
      <td>${parseInt(m)}/${parseInt(d)}${dowSpan(dow)}</td>
      <td>${s.start}</td>
      <td>${s.end}</td>
      <td>${s.break}分</td>
      <td><button class="btn-sm btn-danger" onclick="deleteShift(${s.id})">削除</button></td>
    </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ---- 給与明細 ----
function renderPayslip(ym, workedDays, sortedDates, days) {
  const [y, m] = ym.split('-');
  document.getElementById('payslip-month-label').textContent = `${y}年${parseInt(m)}月`;
  const body = document.getElementById('payslip-body');
  const rate = DB.getRate(ym);
  if (!rate) {
    body.innerHTML = '<div class="payslip-empty">時給を設定すると表示されます</div>';
    return;
  }

  // 通常時間・残業時間を日ごとに集計
  let normalMins = 0, overMins = 0;
  for (const date of sortedDates) {
    const p = days[date].punch;
    if (!p) continue;
    const mins = calcPunchMinutes(p);
    normalMins += Math.min(mins, 480);
    overMins   += Math.max(0, mins - 480);
  }
  const basicWage    = Math.floor(normalMins / 60 * rate);
  const overtimeWage = Math.floor(overMins   / 60 * rate * 1.25);
  const transport    = DB.transportFee > 0 ? DB.transportFee * workedDays : 0;
  const total        = basicWage + overtimeWage + transport;

  const fh = m => m > 0 ? `${Math.floor(m/60)}h${m%60 > 0 ? m%60+'m' : ''}` : '0h';

  body.innerHTML = `
    <div class="payslip-divider">勤怠</div>
    <div class="payslip-row">
      <div><div class="pl-label">出勤日数</div></div>
      <div class="pl-amount">${workedDays} 日</div>
    </div>
    <div class="payslip-row">
      <div><div class="pl-label">実働時間</div><div class="pl-sub">通常 ${fh(normalMins)}　残業 ${fh(overMins)}</div></div>
      <div class="pl-amount">${fh(normalMins + overMins)}</div>
    </div>
    <div class="payslip-divider">支給</div>
    <div class="payslip-row">
      <div><div class="pl-label">基本給</div><div class="pl-sub">¥${rate.toLocaleString()} × ${minutesToHM(normalMins)}h</div></div>
      <div class="pl-amount">${fmtWage(basicWage)}</div>
    </div>
    ${overMins > 0 ? `
    <div class="payslip-row">
      <div><div class="pl-label">残業代</div><div class="pl-sub">¥${rate.toLocaleString()} × 1.25 × ${minutesToHM(overMins)}h</div></div>
      <div class="pl-amount" style="color:#c05621">${fmtWage(overtimeWage)}</div>
    </div>` : ''}
    ${transport > 0 ? `
    <div class="payslip-row">
      <div><div class="pl-label">交通費</div><div class="pl-sub">¥${DB.transportFee.toLocaleString()} × ${workedDays}日</div></div>
      <div class="pl-amount">${fmtWage(transport)}</div>
    </div>` : ''}
    <div class="payslip-row pl-total">
      <div class="pl-label">合計支給額</div>
      <div class="pl-amount">${fmtWage(total)}</div>
    </div>
  `;
}

// ---- 有給管理 ----

// 労働基準法に基づく比例付与テーブル (継続勤務月数×週所定労働日数)
const LEAVE_MONTHS = [6, 18, 30, 42, 54, 66, 78];
const LEAVE_DAYS_TABLE = {
  5: [10, 11, 12, 14, 16, 18, 20],
  4: [ 7,  8,  9, 10, 12, 13, 15],
  3: [ 5,  6,  6,  8,  9, 10, 11],
  2: [ 3,  4,  4,  5,  6,  6,  7],
  1: [ 1,  2,  2,  2,  3,  3,  3],
};
function getLeaveDays(monthsIdx) {
  const wd = Math.min(5, Math.max(1, DB.weeklyDays));
  return LEAVE_DAYS_TABLE[wd][monthsIdx];
}

function diffMonths(from, to) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function calcLeaveGrants(hireDate) {
  const hire = new Date(hireDate);
  const now  = new Date();
  return LEAVE_MONTHS.map((months, i) => {
    const grantDate = new Date(hire);
    grantDate.setMonth(grantDate.getMonth() + months);
    return { months, days: getLeaveDays(i), grantDate, isPast: grantDate <= now };
  });
}

function calcTotalGranted(hireDate) {
  const grants = calcLeaveGrants(hireDate).filter(g => g.isPast);
  if (!grants.length) return 0;
  return grants.slice(-2).reduce((sum, g) => sum + g.days, 0);
}

function saveHireDate() {
  const val = document.getElementById('hire-date').value;
  if (!val) { showToast('入社日を入力してください'); return; }
  DB.hireDate = val;
  SYNC.push();
  showToast('入社日を保存しました');
  renderLeave();
}

function autoCalcWeeklyDays() {
  const shifts  = DB.shifts;
  const punches = DB.punches.filter(p => p.in && p.out);
  const dates   = [...new Set(
    (shifts.length ? shifts.map(s => s.date) : punches.map(p => p.date))
  )].sort();

  let days = 5, needed = 0;
  if (dates.length > 0) {
    const getMonday = d => {
      const day = d.getDay();
      const mon = new Date(d);
      mon.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
      mon.setHours(0,0,0,0);
      return mon;
    };
    const firstMon  = getMonday(new Date(dates[0]));
    const lastMon   = getMonday(new Date(dates[dates.length - 1]));
    const weekCount = Math.round((lastMon - firstMon) / (7*86400000)) + 1;
    days   = Math.min(5, Math.max(1, Math.round(dates.length / weekCount)));
    needed = Math.max(0, Math.ceil(5 * weekCount) - dates.length);
  }

  DB.weeklyDays = days;
  const el = document.getElementById('weekly-days-display');
  if (!el) return;
  if (days >= 5 || needed === 0) {
    el.innerHTML = `<span style="color:#4a5568;font-weight:600">週所定労働日数：${days}日（自動）</span>`;
  } else {
    const hd = DB.hireDate;
    const nextGrant = hd ? calcLeaveGrants(hd).find(g => !g.isPast) : null;
    let suffix = '';
    if (nextGrant) {
      const g = nextGrant.grantDate;
      suffix = `（${g.getMonth()+1}/${g.getDate()}の付与まで）`;
    }
    el.innerHTML = `<span style="color:#4a5568;font-weight:600">週所定労働日数：${days}日（自動）</span>
      <span style="font-size:12px;color:#e53e3e;margin-left:8px">週5まであと${needed}日${suffix}</span>`;
  }
}

function addLeave() {
  const date = document.getElementById('leave-date').value;
  const memo = document.getElementById('leave-memo').value.trim();
  if (!date) { showToast('日付を入力してください'); return; }
  const records = DB.leaveUsed;
  if (records.find(r => r.date === date)) { showToast('その日はすでに記録済みです'); return; }
  records.push({ id: Date.now(), date, memo });
  records.sort((a, b) => b.date.localeCompare(a.date));
  DB.leaveUsed = records;
  SYNC.push();
  document.getElementById('leave-memo').value = '';
  showToast('有給を記録しました');
  renderLeave();
}

function deleteLeave(id) {
  DB.leaveUsed = DB.leaveUsed.filter(r => r.id !== id);
  SYNC.push();
  showToast('削除しました');
  renderLeave();
}

function renderLeave() {
  // 入社日欄
  const hd = DB.hireDate;
  if (hd) document.getElementById('hire-date').value = hd;
  autoCalcWeeklyDays();

  // 勤続情報
  const tenureEl = document.getElementById('leave-tenure');
  if (hd) {
    const hire = new Date(hd);
    const now  = new Date();
    const m = diffMonths(hire, now);
    tenureEl.textContent = `勤続 ${Math.floor(m/12)}年${m%12}ヶ月`;
  } else {
    tenureEl.textContent = '';
  }

  // サマリー
  const summaryBody = document.getElementById('leave-summary-body');
  if (!hd) {
    summaryBody.innerHTML = '<p class="empty-msg">入社日を設定してください</p>';
    renderLeaveList();
    return;
  }
  const grants  = calcLeaveGrants(hd);
  const granted = calcTotalGranted(hd);
  const used    = DB.leaveUsed.length;
  const remain  = Math.max(0, granted - used);
  const pct     = granted > 0 ? Math.round(used / granted * 100) : 0;

  summaryBody.innerHTML = `
    <div class="leave-grid">
      <div class="leave-cell">
        <div class="lc-label">付与日数</div>
        <div class="lc-value-row"><div class="lc-value">${granted}</div><div class="lc-unit">日</div></div>
      </div>
      <div class="leave-cell">
        <div class="lc-label">使用日数</div>
        <div class="lc-value-row"><div class="lc-value">${used}</div><div class="lc-unit">日</div></div>
      </div>
      <div class="leave-cell remaining">
        <div class="lc-label">残日数</div>
        <div class="lc-value-row"><div class="lc-value">${remain}</div><div class="lc-unit">日</div></div>
      </div>
    </div>
    <div class="leave-progress">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#718096;margin-bottom:4px">
        <span>消化率</span><span>${pct}%</span>
      </div>
      <div class="leave-progress-bar">
        <div class="leave-progress-fill" style="width:${pct}%"></div>
      </div>
    </div>
    <div class="leave-grant-list">
      <div style="font-size:12px;font-weight:600;color:#718096;margin-bottom:8px">付与スケジュール</div>
      ${grants.map(g => {
        const [y,m,d] = [g.grantDate.getFullYear(), g.grantDate.getMonth()+1, g.grantDate.getDate()];
        const label = `${y}/${m}/${d}　+${g.days}日`;
        return `<div class="leave-grant-item">
          <div class="leave-grant-dot ${g.isPast ? 'done' : 'future'}"></div>
          <span style="flex:1;color:${g.isPast ? '#1a202c' : '#a0aec0'}">${label}</span>
          <span style="font-size:11px;color:${g.isPast ? '#AA0000' : '#cbd5e0'}">${g.isPast ? '付与済み' : '予定'}</span>
        </div>`;
      }).join('')}
    </div>
  `;

  renderLeaveList();
}

function renderLeaveList() {
  const container = document.getElementById('leave-list-container');
  const records = DB.leaveUsed;
  if (!records.length) {
    container.innerHTML = '<p class="empty-msg">記録がありません</p>';
    return;
  }
  const DOW = ['日','月','火','水','木','金','土'];
  let html = `<table><thead><tr><th>日付</th><th>メモ</th><th></th></tr></thead><tbody>`;
  for (const r of records) {
    const [y,m,d] = r.date.split('-');
    const dow = DOW[new Date(r.date).getDay()];
    html += `<tr>
      <td>${parseInt(m)}/${parseInt(d)}${dowSpan(dow)}</td>
      <td style="color:#718096;font-size:13px">${r.memo || '-'}</td>
      <td><button class="btn-sm btn-danger" onclick="deleteLeave(${r.id})">削除</button></td>
    </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ---- 週次サマリー ----
function getWeekStart(date) {
  // 月曜始まり
  const d = new Date(date);
  const day = d.getDay(); // 0=日
  const diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateToStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function renderWeekly() {
  const container = document.getElementById('weekly-container');
  const punches = DB.punches;
  const shifts  = DB.shifts;
  if (!punches.length && !shifts.length) {
    container.innerHTML = '<p class="empty-msg">データがありません</p>';
    return;
  }

  // 全データの日付からユニークな週を収集
  const allDates = [...punches.map(p => p.date), ...shifts.map(s => s.date)];
  const weekStarts = new Map(); // weekKey -> weekStartDate
  for (const date of allDates) {
    const ws = getWeekStart(date);
    const key = dateToStr(ws);
    if (!weekStarts.has(key)) weekStarts.set(key, ws);
  }

  // 今週も必ず含める
  const thisWeek = getWeekStart(new Date());
  const thisKey  = dateToStr(thisWeek);
  if (!weekStarts.has(thisKey)) weekStarts.set(thisKey, thisWeek);

  // 新しい順に並べる
  const weeks = [...weekStarts.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const DOW = ['日','月','火','水','木','金','土'];
  const hasWage = DB.hourlyRate > 0 || Object.keys(DB.hourlyRates).length > 0;
  const hasTrans = DB.transportFee > 0;

  let html = '';
  for (const [wsKey, wsDate] of weeks) {
    const weDate = new Date(wsDate);
    weDate.setDate(weDate.getDate() + 6); // 日曜
    const isCurrentWeek = wsKey === thisKey;

    // 週の各日を生成（月〜日）
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(wsDate);
      d.setDate(d.getDate() + i);
      weekDates.push(dateToStr(d));
    }

    // 集計
    let actualMins = 0, plannedMins = 0, workedDays = 0, shiftDays = 0;
    for (const date of weekDates) {
      const p  = punches.find(x => x.date === date);
      const ss = shifts.filter(x => x.date === date);
      if (p) {
        const m = calcPunchMinutes(p);
        actualMins += m;
        if (m > 0 || p.in) workedDays++;
      }
      if (ss.length) {
        plannedMins += ss.reduce((a, s) => a + s.work, 0);
        shiftDays++;
      }
    }
    const ym = wsKey.substring(0, 7);
    const wage = calcWage(actualMins, ym);
    const transport = hasTrans && workedDays > 0 ? DB.transportFee * workedDays : null;

    // 週の日付範囲ラベル
    const fmt = d => `${d.getMonth()+1}/${d.getDate()}`;
    const rangeLabel = `${fmt(wsDate)}(月) 〜 ${fmt(weDate)}(日)`;

    // 各曜日チップ
    const dayChips = weekDates.map((date, i) => {
      const dow = i + 1; // 月=1...日=7→0
      const realDow = dow === 7 ? 0 : dow;
      const hasPunch  = punches.find(x => x.date === date);
      const hasShift  = shifts.find(x => x.date === date);
      const label = DOW[realDow];
      let cls = 'week-day-chip';
      if (realDow === 0) cls += ' sun';
      else if (realDow === 6) cls += ' sat';
      if (hasPunch) cls += ' worked';
      else if (hasShift) cls += ' planned';
      else cls += ' off';
      return `<span class="${cls}">${label}</span>`;
    }).join('');

    html += `
    <div class="week-card">
      <div class="week-card-header">
        <div class="week-range">${rangeLabel}</div>
        <span class="week-badge ${isCurrentWeek ? 'current' : 'past'}">${isCurrentWeek ? '今週' : '終了'}</span>
      </div>
      <div class="week-grid">
        <div class="week-cell"><div class="wc-label">出勤</div><div class="wc-value-row"><div class="wc-value">${workedDays}</div><div class="wc-unit">日</div></div></div>
        <div class="week-cell"><div class="wc-label">実働</div><div class="wc-value-row"><div class="wc-value">${actualMins ? minutesToHM(actualMins) : '-'}</div>${actualMins ? '<div class="wc-unit">h</div>' : ''}</div></div>
        <div class="week-cell"><div class="wc-label">シフト</div><div class="wc-value-row"><div class="wc-value">${plannedMins ? minutesToHM(plannedMins) : '-'}</div>${plannedMins ? '<div class="wc-unit">h</div>' : ''}</div></div>
        ${hasWage ? `<div class="week-cell highlight"><div class="wc-label">給与</div><div class="wc-value-row"><div class="wc-value" style="font-size:14px">${wage !== null ? '¥'+wage.toLocaleString() : '-'}</div></div></div>` : '<div class="week-cell"></div>'}
      </div>
      <div class="week-days-row">${dayChips}</div>
    </div>`;
  }

  container.innerHTML = html || '<p class="empty-msg">データがありません</p>';
}

// ---- 週次サマリー（月次集計内） ----
function renderSummaryWeekly(ym) {
  const container = document.getElementById('summary-weekly-container');
  const punches = DB.punches;
  const shifts  = DB.shifts;

  // 選択月に1日でも含まれる週を収集
  const [y, m] = ym.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay  = new Date(y, m, 0);
  const weekStarts = new Map();

  // その月の各日の週を登録
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const ws = getWeekStart(new Date(d));
    const key = dateToStr(ws);
    if (!weekStarts.has(key)) weekStarts.set(key, new Date(ws));
  }

  if (!weekStarts.size) {
    container.innerHTML = '<p class="empty-msg">データがありません</p>';
    return;
  }

  const weeks = [...weekStarts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const DOW = ['日','月','火','水','木','金','土'];
  const hasWage  = DB.hourlyRate > 0 || Object.keys(DB.hourlyRates).length > 0;
  const hasTrans = DB.transportFee > 0;
  const todayStr2 = todayStr();

  let html = '';
  for (const [wsKey, wsDate] of weeks) {
    const weDate = new Date(wsDate);
    weDate.setDate(weDate.getDate() + 6);

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(wsDate);
      d.setDate(d.getDate() + i);
      weekDates.push(dateToStr(d));
    }

    let actualMins = 0, plannedMins = 0, workedDays = 0;
    for (const date of weekDates) {
      const p  = punches.find(x => x.date === date);
      const ss = shifts.filter(x => x.date === date);
      if (p) { const m2 = calcPunchMinutes(p); actualMins += m2; if (m2 > 0 || p.in) workedDays++; }
      if (ss.length) plannedMins += ss.reduce((a, s) => a + s.work, 0);
    }

    const wage      = hasWage  ? calcWage(actualMins, ym) : null;
    const transport = hasTrans && workedDays > 0 ? DB.transportFee * workedDays : null;

    const fmt = d => `${d.getMonth()+1}/${d.getDate()}`;
    const rangeLabel = `${fmt(wsDate)}(月) 〜 ${fmt(weDate)}(日)`;
    const isCurrentWeek = weekDates.includes(todayStr2);

    const dayChips = weekDates.map((date, i) => {
      const dow = i + 1;
      const realDow = dow === 7 ? 0 : dow;
      const hasPunch = punches.find(x => x.date === date);
      const hasShift = shifts.find(x => x.date === date);
      const inMonth  = date.startsWith(ym);
      let cls = 'week-day-chip';
      if (realDow === 0) cls += ' sun';
      else if (realDow === 6) cls += ' sat';
      if (!inMonth) cls += ' off'; // 月外はグレー
      else if (hasPunch) cls += ' worked';
      else if (hasShift) cls += ' planned';
      else cls += ' off';
      return `<span class="${cls}">${DOW[realDow]}</span>`;
    }).join('');

    html += `
    <div class="week-card">
      <div class="week-card-header">
        <div class="week-range">${rangeLabel}</div>
        <span class="week-badge ${isCurrentWeek ? 'current' : 'past'}">${isCurrentWeek ? '今週' : '終了'}</span>
      </div>
      <div class="week-grid">
        <div class="week-cell"><div class="wc-label">出勤</div><div class="wc-value-row"><div class="wc-value">${workedDays}</div><div class="wc-unit">日</div></div></div>
        <div class="week-cell"><div class="wc-label">実働</div><div class="wc-value-row"><div class="wc-value">${actualMins ? minutesToHM(actualMins) : '-'}</div>${actualMins ? '<div class="wc-unit">h</div>' : ''}</div></div>
        <div class="week-cell"><div class="wc-label">シフト</div><div class="wc-value-row"><div class="wc-value">${plannedMins ? minutesToHM(plannedMins) : '-'}</div>${plannedMins ? '<div class="wc-unit">h</div>' : ''}</div></div>
        ${hasWage ? `<div class="week-cell highlight"><div class="wc-label">給与</div><div class="wc-value-row"><div class="wc-value" style="font-size:14px">${wage !== null ? '¥'+wage.toLocaleString() : '-'}</div></div></div>` : '<div class="week-cell"></div>'}
      </div>
      <div class="week-days-row">${dayChips}</div>
    </div>`;
  }

  container.innerHTML = html || '<p class="empty-msg">データがありません</p>';
}

// ---- カレンダー（月次集計内） ----
function renderSummaryCalendar(ym, days) {
  const grid = document.getElementById('summary-cal-grid');
  const [y, m] = ym.split('-').map(Number);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;

  const firstDow  = new Date(y, m - 1, 1).getDay(); // 0=日
  const totalDays = new Date(y, m, 0).getDate();
  const prevTotal = new Date(y, m - 1, 0).getDate();
  const totalCells = Math.ceil((firstDow + totalDays) / 7) * 7;

  const DOW_LABEL = ['日','月','火','水','木','金','土'];
  let html = DOW_LABEL.map((d, i) =>
    `<div class="cal-dow" style="color:${i===0?'#e53e3e':i===6?'#3182ce':'#718096'}">${d}</div>`
  ).join('');

  for (let i = 0; i < totalCells; i++) {
    const col = i % 7;
    if (i < firstDow) {
      // 先月
      html += `<div class="cal-cell cal-other"><span class="cal-num">${prevTotal - firstDow + i + 1}</span></div>`;
    } else {
      const d = i - firstDow + 1;
      if (d > totalDays) {
        // 翌月
        html += `<div class="cal-cell cal-other"><span class="cal-num">${d - totalDays}</span></div>`;
      } else {
        const dateStr = `${ym}-${pad(d)}`;
        const dayData = days[dateStr];
        const punch   = dayData?.punch;
        const shift   = (dayData?.shifts || [])[0]; // 最初のシフト
        const isToday = dateStr === todayStr;
        const worked  = punch && punch.in && punch.out;

        let cls = 'cal-cell';
        if (col === 0) cls += ' cal-sun';
        if (col === 6) cls += ' cal-sat';
        if (isToday)  cls += ' cal-today';
        if (worked)   cls += ' cal-work';
        else if (shift) cls += ' cal-shift-only';

        let inner = `<span class="cal-num">${d}</span>`;
        if (shift) {
          const sh = parseInt(shift.start);
          const eh = parseInt(shift.end);
          inner += `<span class="cal-shift-label">${sh}〜${eh}</span>`;
        }
        if (worked) {
          inner += `<span class="cal-punch-label">${minutesToHM(calcPunchMinutes(punch))}</span>`;
        }
        html += `<div class="${cls}">${inner}</div>`;
      }
    }
  }
  grid.innerHTML = html;
}

// ---- タブ用月セレクター共通初期化 ----
function initTabMonthSelector(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const year = new Date().getFullYear();
  const cur  = `${year}-${pad(new Date().getMonth()+1)}`;
  for (let m = 1; m <= 12; m++) {
    const val = `${year}-${pad(m)}`;
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = `${year}年${m}月`;
    if (val === cur) opt.selected = true;
    sel.appendChild(opt);
  }
}

// ---- 月次集計 ----
function initMonthSelector() {
  const sel = document.getElementById('summary-month');
  const year = new Date().getFullYear();
  const cur  = `${year}-${pad(new Date().getMonth()+1)}`;
  for (let m = 1; m <= 12; m++) {
    const val = `${year}-${pad(m)}`;
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = `${year}年${m}月`;
    if (val === cur) opt.selected = true;
    sel.appendChild(opt);
  }
}

function renderSummary() {
  const ym = document.getElementById('summary-month').value;
  const punches = DB.punches.filter(p => p.date.startsWith(ym));
  const shifts  = DB.shifts.filter(s => s.date.startsWith(ym));
  const days = {};
  for (const p of punches) { days[p.date] = { punch: p }; }
  for (const s of shifts) {
    if (!days[s.date]) days[s.date] = {};
    (days[s.date].shifts = days[s.date].shifts || []).push(s);
  }
  const sortedDates = Object.keys(days).sort();
  let totalActual = 0, totalPlanned = 0, workedDays = 0;
  for (const date of sortedDates) {
    const actual = days[date].punch ? calcPunchMinutes(days[date].punch) : 0;
    const planned = (days[date].shifts || []).reduce((a, s) => a + s.work, 0);
    if (actual > 0) { totalActual += actual; workedDays++; }
    totalPlanned += planned;
  }
  // 月次合計給与: 日毎に計算して合算（月別時給・残業割増を正確に反映）
  const totalWage = (() => {
    let sum = 0; let hasRate = false;
    for (const date of sortedDates) {
      const p = days[date].punch;
      if (!p) continue;
      const w = calcWage(calcPunchMinutes(p), date.substring(0, 7));
      if (w !== null) { sum += w; hasRate = true; }
    }
    return hasRate ? sum : null;
  })();

  const totalTransport = DB.transportFee > 0 ? DB.transportFee * workedDays : null;

  document.getElementById('stat-actual').textContent    = minutesToHM(totalActual);
  document.getElementById('stat-planned').textContent   = minutesToHMShort(totalPlanned);
  document.getElementById('stat-days').textContent      = workedDays;
  // 週平均出勤日数: その月に含まれる週数で割る
  const [sy, sm] = ym.split('-').map(Number);
  const firstDay = new Date(sy, sm-1, 1);
  const lastDay  = new Date(sy, sm, 0);
  const dow0 = firstDay.getDay();
  const firstMon = new Date(firstDay);
  firstMon.setDate(firstDay.getDate() + (dow0 === 0 ? -6 : 1 - dow0));
  let weekCount = 0, ws = new Date(firstMon);
  while (ws <= lastDay) { weekCount++; ws.setDate(ws.getDate() + 7); }
  const statAvgVal = weekCount > 0 ? workedDays / weekCount : 0;
  document.getElementById('stat-avg').textContent = statAvgVal % 1 === 0 ? statAvgVal : statAvgVal.toFixed(1);
  document.getElementById('stat-wage').textContent      = totalWage !== null ? totalWage.toLocaleString() : '--';
  document.getElementById('stat-transport').textContent = totalTransport !== null ? totalTransport.toLocaleString() : '--';

  // カレンダー描画
  renderSummaryCalendar(ym, days);

  // 週次サマリー描画
  renderSummaryWeekly(ym);

  const container = document.getElementById('summary-table-container');
  if (!sortedDates.length) { container.innerHTML = '<p class="empty-msg">データがありません</p>'; return; }

  const hasWage = DB.getRate(ym) > 0;
  let html = `<table><thead><tr><th>日</th><th>シフト</th><th>実働</th><th>残業</th>${hasWage ? '<th>給与</th>' : ''}</tr></thead><tbody>`;
  for (const date of sortedDates) {
    const p = days[date].punch;
    const actualMins  = p ? calcPunchMinutes(p) : 0;
    const plannedMins = (days[date].shifts || []).reduce((a, s) => a + s.work, 0);
    const overtimeMins = plannedMins > 0 ? Math.max(0, actualMins - plannedMins) : 0;
    const [dy, dm, dd] = date.split('-');
    const dow = ['日','月','火','水','木','金','土'][new Date(date).getDay()];
    const wage = actualMins > 0 ? calcWage(actualMins, date.substring(0, 7)) : null;
    html += `<tr>
      <td>${parseInt(dm)}/${parseInt(dd)}${dowSpan(dow)}</td>
      <td>${plannedMins ? minutesToHMFull(plannedMins) : '-'}</td>
      <td>${actualMins ? '<span class="badge badge-blue">'+minutesToHM(actualMins)+'</span>' : '-'}</td>
      <td>${overtimeMins ? '<span class="badge badge-yellow">'+minutesToHM(overtimeMins)+'</span>' : '-'}</td>
      ${hasWage ? `<td>${wage !== null ? '<span class="wage-chip">'+fmtWage(wage)+'</span>' : '-'}</td>` : ''}
    </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ---- CSV出力（月次）----
function exportCSV() {
  const ym = document.getElementById('summary-month').value;
  const punches = DB.punches.filter(p => p.date.startsWith(ym));
  const shifts  = DB.shifts.filter(s => s.date.startsWith(ym));
  const days = {};
  for (const p of punches) { days[p.date] = { punch: p }; }
  for (const s of shifts) {
    if (!days[s.date]) days[s.date] = {};
    (days[s.date].shifts = days[s.date].shifts || []).push(s);
  }
  let csv = '日付,出勤,退勤,実働時間,予定時間,差分,給与,交通費\n';
  for (const date of Object.keys(days).sort()) {
    const p = days[date].punch;
    const actual  = p ? calcPunchMinutes(p) : 0;
    const planned = (days[date].shifts || []).reduce((a, s) => a + s.work, 0);
    const wage = calcWage(actual, date.substring(0, 7));
    const transport = (p && actual > 0 && DB.transportFee) ? DB.transportFee : '';
    csv += `${date},${p?.in??''},${p?.out??''},${minutesToHM(actual)},${minutesToHM(planned)},${minutesToHM(actual-planned)},${wage ?? ''},${transport}\n`;
  }
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `勤務記録_${ym}.csv`;
  a.click();
  showToast('CSVを出力しました');
}

// 月の給与を日ごとに正確に計算（月次集計と同じロジック）
function calcMonthWage(ym) {
  const punches = DB.punches.filter(p => p.date.startsWith(ym) && p.in && p.out);
  if (!punches.length) return null;
  let sum = 0; let hasRate = false;
  for (const p of punches) {
    const w = calcWage(calcPunchMinutes(p), ym);
    if (w !== null) { sum += w; hasRate = true; }
  }
  return hasRate ? sum : null;
}

// ---- 年間集計 ----
function initYearSelector() {
  const sel = document.getElementById('annual-year');
  const now = new Date();
  for (let i = 0; i < 5; i++) {
    const y = now.getFullYear() - i;
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = `${y}年`;
    sel.appendChild(opt);
  }
}

function getMonthData(ym) {
  const punches = DB.punches.filter(p => p.date.startsWith(ym));
  const shifts  = DB.shifts.filter(s => s.date.startsWith(ym));
  let actualMins = 0, plannedMins = 0, workedDays = 0, overtimeMins = 0;
  const dateSet = new Set([...punches.map(p => p.date), ...shifts.map(s => s.date)]);
  for (const date of dateSet) {
    const p  = punches.find(x => x.date === date);
    const ss = shifts.filter(x => x.date === date);
    const a  = p ? calcPunchMinutes(p) : 0;
    const plan = ss.reduce((acc, s) => acc + s.work, 0);
    if (a > 0) { actualMins += a; workedDays++; }
    plannedMins += plan;
    if (a > plan && plan > 0) overtimeMins += (a - plan);
  }
  return { actualMins, plannedMins, workedDays, overtimeMins };
}

function renderAnnual() {
  const year = document.getElementById('annual-year').value;
  let totalActual = 0, totalPlanned = 0, totalDays = 0, totalOvertime = 0;
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${pad(m)}`;
    const data = getMonthData(ym);
    months.push({ m, ym, ...data });
    totalActual   += data.actualMins;
    totalPlanned  += data.plannedMins;
    totalDays     += data.workedDays;
    totalOvertime += data.overtimeMins;
  }
  // 年間合計給与: 日ごとに正確に計算して合算
  const totalWage = (() => {
    let sum = 0; let hasRate = false;
    for (const { ym: mym } of months) {
      const w = calcMonthWage(mym);
      if (w !== null) { sum += w; hasRate = true; }
    }
    return hasRate ? sum : null;
  })();
  const activeMonths = months.filter(m => m.actualMins > 0).length;

  const totalTransport = DB.transportFee > 0 ? DB.transportFee * totalDays : null;

  document.getElementById('ann-actual').textContent    = minutesToHM(totalActual);
  document.getElementById('ann-planned').textContent   = minutesToHMShort(totalPlanned);
  document.getElementById('ann-days').textContent      = totalDays;
  const annAvgVal = activeMonths > 0 ? totalDays / activeMonths : 0;
  document.getElementById('ann-avg').textContent = annAvgVal % 1 === 0 ? annAvgVal : annAvgVal.toFixed(1);
  document.getElementById('ann-wage').textContent      = totalWage !== null ? totalWage.toLocaleString() : '--';
  document.getElementById('ann-transport').textContent = totalTransport !== null ? totalTransport.toLocaleString() : '--';

  // バーチャート
  const maxMins = Math.max(...months.map(m => Math.max(m.actualMins, m.plannedMins)), 1);
  document.getElementById('annual-chart').innerHTML = months.map(({ m, ym: mym, actualMins, plannedMins }) => {
    const aW = (actualMins / maxMins * 100).toFixed(1);
    const pW = (plannedMins / maxMins * 100).toFixed(1);
    const wStr = calcMonthWage(mym);
    return `<div class="bar-row">
      <div class="bar-month">${m}月</div>
      <div class="bar-wrap">
        <div class="bar-track"><div class="bar-fill-actual" style="width:${aW}%"></div></div>
        <div class="bar-track"><div class="bar-fill-planned" style="width:${pW}%"></div></div>
      </div>
      <div class="bar-label">${actualMins ? minutesToHM(actualMins) : '-'}${wStr !== null ? ' / '+fmtWage(wStr) : ''}</div>
    </div>`;
  }).join('');

  // 月別テーブル
  const container = document.getElementById('annual-table-container');
  const hasData = months.some(m => m.actualMins > 0 || m.plannedMins > 0);
  if (!hasData) { container.innerHTML = '<p class="empty-msg">データがありません</p>'; return; }

  const hasWage = months.some(({ ym: mym }) => DB.getRate(mym) > 0);
  let html = `<table style="font-size:12px"><thead><tr><th>月</th><th>出勤</th><th>シフト</th><th>実働</th><th>残業</th>${hasWage ? '<th>給与</th>' : ''}</tr></thead><tbody>`;
  for (const { m, ym: mym, actualMins, plannedMins, workedDays, overtimeMins } of months) {
    const wage = calcMonthWage(mym);
    html += `<tr>
      <td style="white-space:nowrap">${m}月</td>
      <td>${workedDays > 0 ? workedDays : '-'}</td>
      <td>${plannedMins ? minutesToHM(plannedMins) : '-'}</td>
      <td>${actualMins ? minutesToHM(actualMins) : '-'}</td>
      <td>${overtimeMins ? minutesToHM(overtimeMins) : '-'}</td>
      ${hasWage ? `<td>${wage !== null ? fmtWage(wage) : '-'}</td>` : ''}
    </tr>`;
  }
  html += `<tr style="font-weight:700;background:#f7fafc">
    <td style="white-space:nowrap">合計</td>
    <td>${totalDays > 0 ? totalDays : '-'}</td>
    <td>${totalPlanned ? minutesToHM(totalPlanned) : '-'}</td>
    <td>${totalActual ? minutesToHM(totalActual) : '-'}</td>
    <td>${totalOvertime ? minutesToHM(totalOvertime) : '-'}</td>
    ${hasWage ? `<td>${totalWage !== null ? fmtWage(totalWage) : '-'}</td>` : ''}
  </tr>`;
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ---- CSV出力（年間）----
function exportAnnualCSV() {
  const year = document.getElementById('annual-year').value;
  let csv = '月,実労働時間,予定時間,差分,出勤日数,給与,交通費\n';
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${pad(m)}`;
    const { actualMins, plannedMins, workedDays } = getMonthData(ym);
    const wage = calcWage(actualMins, ym);
    const transport = DB.transportFee > 0 ? DB.transportFee * workedDays : '';
    csv += `${year}/${pad(m)},${minutesToHM(actualMins)},${minutesToHM(plannedMins)},${minutesToHM(actualMins-plannedMins)},${workedDays},${wage ?? ''},${transport}\n`;
  }
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `年間勤務記録_${year}.csv`;
  a.click();
  showToast('CSVを出力しました');
}

// ---- 初期化 ----
document.getElementById('shift-date').value = todayStr();
document.getElementById('leave-date').value  = todayStr();
const savedRate = DB.hourlyRate;
if (savedRate) document.getElementById('hourly-rate').value = savedRate;
const savedTransport = DB.transportFee;
if (savedTransport) document.getElementById('transport-fee').value = savedTransport;
// 月別時給の月を今月にデフォルト設定
document.getElementById('wage-month').value = todayStr().substring(0, 7);
updateWageDisplay();
updateTransportDisplay();
renderMonthlyRatesList();
// ---- 休憩時間マイグレーション（一回のみ）----
// 7時間以上→60分、未満→0分 に一括修正
function migrateBreakTimes() {
  if (localStorage.getItem('wt_break_migrated_v3')) return;
  const shifts = DB.shifts;
  let changed = false;
  const fixed = shifts.map(s => {
    const sh = parseInt(s.start);
    const eh = parseInt(s.end);
    if (isNaN(sh) || isNaN(eh)) return s;
    const diff = eh - sh;
    const brk  = diff >= 7 ? 60 : 0;
    const work  = diff * 60 - brk;
    if (s.break !== brk) { changed = true; return { ...s, break: brk, work }; }
    return s;
  });
  if (changed) {
    DB.shifts = fixed;
    SYNC.push();
    renderShiftList();
    console.log('[TimeKeeper] 休憩時間を自動修正しました');
  }
  localStorage.setItem('wt_break_migrated_v3', '1');
}

initTabMonthSelector('punch-month');
initTabMonthSelector('shift-month');
initMonthSelector();
initYearSelector();
refreshPunchUI();
renderShiftList();
// 起動時に自動バックアップ保存＆一覧表示
saveAutoBackup();
renderAutoBackupList();

// 同期UI初期化
updateSyncUI();

// 自動pull（起動時 + 3分ごと）
async function autoPull() {
  if (!SYNC.key) return;
  const ok = await SYNC.pull();
  if (ok) {
    refreshPunchUI();
    renderShiftList();
    renderSummary();
    renderAnnual();
    const status = document.getElementById('sync-status');
    if (status) status.textContent = '✅ 自動同期済み ' + new Date().toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'});
  }
}

// APIキーが設定済みなら起動時に自動sync（pull後にマイグレーション実行）
if (SYNC.key) {
  autoPull().then(() => migrateBreakTimes());
  // 3分ごとに定期pull
  setInterval(autoPull, 3 * 60 * 1000);
} else {
  // クラウド同期なしの場合はそのまま実行
  migrateBreakTimes();
}
