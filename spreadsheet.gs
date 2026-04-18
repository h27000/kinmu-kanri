// 勤務時間管理 - Google Apps Script

const SS_ID = '1VLybd7B02tQZfOEw2BO4iIiAAkQLx2l6j4ff2i0PMKI';

const S = {
  SETTINGS: '設定',
  PUNCH:    '打刻記録',
  SHIFT:    'シフト',
  MONTHLY:  '月次集計',
  ANNUAL:   '年間集計',
};

// ============================================================
// Web App API (GET: load / POST: saveAll)
// ============================================================
function doGet(e) {
  const ss = SpreadsheetApp.openById(SS_ID);
  try {
    const result = loadAll(ss);
    return jsonResponse(result);
  } catch(err) {
    return jsonResponse({error: err.toString()});
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.openById(SS_ID);
    saveAll(ss, data);
    updateAllSummaries_(ss);
    return jsonResponse({ok: true});
  } catch(err) {
    return jsonResponse({error: err.toString()});
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- データ読み込み ----
function loadAll(ss) {
  // 打刻記録
  const pSheet = ss.getSheetByName(S.PUNCH);
  const punches = [];
  if (pSheet && pSheet.getLastRow() > 1) {
    pSheet.getRange(2, 1, pSheet.getLastRow() - 1, 3).getValues().forEach(r => {
      if (!r[0]) return;
      const d = new Date(r[0]);
      if (isNaN(d)) return;
      const tz = ss.getSpreadsheetTimeZone();
      punches.push({
        date: Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
        in:   r[1] ? String(r[1]) : null,
        out:  r[2] ? String(r[2]) : null,
      });
    });
  }

  // シフト
  const sSheet = ss.getSheetByName(S.SHIFT);
  const shifts = [];
  if (sSheet && sSheet.getLastRow() > 1) {
    sSheet.getRange(2, 1, sSheet.getLastRow() - 1, 7).getValues().forEach((r, i) => {
      if (!r[0]) return;
      const d = new Date(r[0]);
      if (isNaN(d)) return;
      const tz = ss.getSpreadsheetTimeZone();
      shifts.push({
        id:    r[6] ? Number(r[6]) : (i + 1),
        date:  Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
        start: String(r[1]),
        end:   String(r[2]),
        break: Number(r[3]) || 0,
        work:  Number(r[4]) || 0,
        memo:  String(r[5] || ''),
      });
    });
  }

  // 時給
  const stSheet  = ss.getSheetByName(S.SETTINGS);
  const hourlyRate = stSheet ? (Number(stSheet.getRange('B2').getValue()) || 0) : 0;

  return { punches, shifts, hourlyRate };
}

// ---- データ保存 ----
function saveAll(ss, data) {
  // 打刻記録を書き込み
  const pSheet = ss.getSheetByName(S.PUNCH);
  if (pSheet && data.punches !== undefined) {
    // ヘッダー以外をクリア
    if (pSheet.getLastRow() > 1) {
      pSheet.getRange(2, 1, pSheet.getLastRow() - 1, 6).clearContent();
    }
    if (data.punches.length > 0) {
      const rows = data.punches.map(p => {
        const mins = calcMins(p.in, p.out);
        const wage = (data.hourlyRate > 0 && mins > 0) ? Math.floor(mins / 60 * data.hourlyRate) : '';
        return [p.date, p.in || '', p.out || '', mins || '', mins ? minsToHM(mins) : '', wage];
      });
      pSheet.getRange(2, 1, rows.length, 6).setValues(rows);
      pSheet.getRange(2, 1, rows.length, 1).setNumberFormat('yyyy/MM/dd');
    }
  }

  // シフトを書き込み
  const sSheet = ss.getSheetByName(S.SHIFT);
  if (sSheet && data.shifts !== undefined) {
    if (sSheet.getLastRow() > 1) {
      sSheet.getRange(2, 1, sSheet.getLastRow() - 1, 7).clearContent();
    }
    if (data.shifts.length > 0) {
      const rows = data.shifts.map(s => [s.date, s.start, s.end, s.break, s.work, s.memo || '', s.id]);
      sSheet.getRange(2, 1, rows.length, 7).setValues(rows);
      sSheet.getRange(2, 1, rows.length, 1).setNumberFormat('yyyy/MM/dd');
    }
  }

  // 時給を保存
  const stSheet = ss.getSheetByName(S.SETTINGS);
  if (stSheet && data.hourlyRate !== undefined) {
    stSheet.getRange('B2').setValue(data.hourlyRate);
  }
}

function calcMins(inTime, outTime) {
  if (!inTime || !outTime) return 0;
  const [ih, im] = inTime.split(':').map(Number);
  const [oh, om] = outTime.split(':').map(Number);
  return (oh * 60 + om) - (ih * 60 + im);
}

// ============================================================
// メニュー (スプレッドシートから使う場合)
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⏰ 勤務管理')
    .addItem('✅ 出勤打刻', 'punchIn')
    .addItem('🏁 退勤打刻', 'punchOut')
    .addSeparator()
    .addItem('📊 集計を更新', 'updateAllSummaries')
    .addSeparator()
    .addItem('⚙️ 初期セットアップ', 'setup')
    .addToUi();
}

function punchIn() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(S.PUNCH);
  if (!sheet) { SpreadsheetApp.getUi().alert('先にセットアップを実行してください'); return; }
  const tz    = ss.getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const now   = Utilities.formatDate(new Date(), tz, 'HH:mm');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (Utilities.formatDate(new Date(data[i][0]), tz, 'yyyy-MM-dd') === today) {
      SpreadsheetApp.getUi().alert('本日はすでに出勤打刻済みです（' + data[i][1] + '）');
      return;
    }
  }
  const r = sheet.getLastRow() + 1;
  sheet.getRange(r, 1).setValue(new Date(today)).setNumberFormat('yyyy/MM/dd');
  sheet.getRange(r, 2).setValue(now);
  SpreadsheetApp.getUi().alert('出勤打刻しました ✅\n' + today + '  ' + now);
}

function punchOut() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(S.PUNCH);
  if (!sheet) { SpreadsheetApp.getUi().alert('先にセットアップを実行してください'); return; }
  const tz    = ss.getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const now   = Utilities.formatDate(new Date(), tz, 'HH:mm');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (Utilities.formatDate(new Date(data[i][0]), tz, 'yyyy-MM-dd') === today) {
      if (data[i][2]) { SpreadsheetApp.getUi().alert('本日はすでに退勤打刻済みです'); return; }
      sheet.getRange(i + 1, 3).setValue(now);
      const mins = calcMins(String(data[i][1]), now);
      sheet.getRange(i + 1, 4).setValue(mins);
      sheet.getRange(i + 1, 5).setValue(minsToHM(mins));
      const rate = Number(ss.getSheetByName(S.SETTINGS)?.getRange('B2').getValue()) || 0;
      if (rate > 0) sheet.getRange(i + 1, 6).setValue(Math.floor(mins / 60 * rate));
      updateAllSummaries();
      SpreadsheetApp.getUi().alert('退勤打刻しました 🏁\n' + today + '  ' + now);
      return;
    }
  }
  SpreadsheetApp.getUi().alert('本日の出勤打刻が見つかりません');
}

// ============================================================
// セットアップ
// ============================================================
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const SHEETS = [
    { name: S.SETTINGS, headers: ['項目', '値'] },
    { name: S.PUNCH,    headers: ['日付', '出勤', '退勤', '実働(分)', '実働時間', '給与(円)'] },
    { name: S.SHIFT,    headers: ['日付', '開始', '終了', '休憩(分)', '実働(分)', '実働時間', 'メモ', 'ID'] },
    { name: S.MONTHLY,  headers: ['年月', '実労働(分)', '実労働時間', '予定(分)', '予定時間', '差分', '出勤日数', '月間給与'] },
    { name: S.ANNUAL,   headers: ['年', '実労働(分)', '実労働時間', '予定(分)', '予定時間', '差分', '出勤日数', '年間給与'] },
  ];
  for (const { name, headers } of SHEETS) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#2d3748').setFontColor('#ffffff')
      .setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }
  const st = ss.getSheetByName(S.SETTINGS);
  if (st.getLastRow() < 2) {
    st.getRange('A2').setValue('時給（円）').setFontWeight('bold');
    st.getRange('B2').setValue(1000);
  }
  const s1 = ss.getSheetByName('シート1');
  if (s1) ss.deleteSheet(s1);
  Logger.log('セットアップ完了！');
}

// ============================================================
// 集計
// ============================================================
function updateAllSummaries() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  updateAllSummaries_(ss);
}

function updateAllSummaries_(ss) {
  updateMonthly_(ss);
  updateAnnual_(ss);
}

function minsToHM(m) {
  if (!m) return '0:00';
  const sign = m < 0 ? '-' : '';
  const abs  = Math.abs(m);
  return sign + Math.floor(abs / 60) + ':' + String(abs % 60).padStart(2, '0');
}

function getHourlyRate_(ss) {
  const s = ss.getSheetByName(S.SETTINGS);
  return s ? (Number(s.getRange('B2').getValue()) || 0) : 0;
}

function updateMonthly_(ss) {
  const monthly = ss.getSheetByName(S.MONTHLY);
  const punch   = ss.getSheetByName(S.PUNCH);
  const shift   = ss.getSheetByName(S.SHIFT);
  if (!monthly || !punch || !shift) return;
  const tz   = ss.getSpreadsheetTimeZone();
  const rate = getHourlyRate_(ss);
  const pData = punch.getDataRange().getValues().slice(1).filter(r => r[0] && r[3] !== '')
    .map(r => ({ ym: Utilities.formatDate(new Date(r[0]), tz, 'yyyy-MM'), mins: Number(r[3]) || 0 }));
  const sData = shift.getDataRange().getValues().slice(1).filter(r => r[0])
    .map(r => ({ ym: Utilities.formatDate(new Date(r[0]), tz, 'yyyy-MM'), mins: Number(r[4]) || 0 }));
  const ymSet  = new Set([...pData.map(r => r.ym), ...sData.map(r => r.ym)]);
  const ymList = [...ymSet].sort();
  if (!ymList.length) return;
  monthly.clearContents();
  const headers = ['年月', '実労働(分)', '実労働時間', '予定(分)', '予定時間', '差分', '出勤日数', '月間給与'];
  monthly.getRange(1, 1, 1, 8).setValues([headers])
    .setBackground('#2d3748').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
  monthly.setFrozenRows(1);
  const rows = ymList.map(ym => {
    const a = pData.filter(r => r.ym === ym).reduce((s, r) => s + r.mins, 0);
    const p = sData.filter(r => r.ym === ym).reduce((s, r) => s + r.mins, 0);
    const d = pData.filter(r => r.ym === ym && r.mins > 0).length;
    const diff = a - p;
    return [ym, a, minsToHM(a), p, minsToHM(p), (diff >= 0 ? '+' : '') + minsToHM(diff), d, rate > 0 ? Math.floor(a / 60 * rate) : ''];
  });
  monthly.getRange(2, 1, rows.length, 8).setValues(rows);
}

function updateAnnual_(ss) {
  const annual  = ss.getSheetByName(S.ANNUAL);
  const monthly = ss.getSheetByName(S.MONTHLY);
  if (!annual || !monthly) return;
  const rate  = getHourlyRate_(ss);
  const mData = monthly.getDataRange().getValues().slice(1).filter(r => r[0]);
  if (!mData.length) return;
  const yearSet  = new Set(mData.map(r => String(r[0]).slice(0, 4)));
  const yearList = [...yearSet].sort();
  annual.clearContents();
  const headers = ['年', '実労働(分)', '実労働時間', '予定(分)', '予定時間', '差分', '出勤日数', '年間給与'];
  annual.getRange(1, 1, 1, 8).setValues([headers])
    .setBackground('#2d3748').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
  annual.setFrozenRows(1);
  const rows = yearList.map(year => {
    const r    = mData.filter(d => String(d[0]).startsWith(year));
    const a    = r.reduce((s, d) => s + (Number(d[1]) || 0), 0);
    const p    = r.reduce((s, d) => s + (Number(d[3]) || 0), 0);
    const days = r.reduce((s, d) => s + (Number(d[6]) || 0), 0);
    const diff = a - p;
    return [year, a, minsToHM(a), p, minsToHM(p), (diff >= 0 ? '+' : '') + minsToHM(diff), days, rate > 0 ? Math.floor(a / 60 * rate) : ''];
  });
  annual.getRange(2, 1, rows.length, 8).setValues(rows);
}
