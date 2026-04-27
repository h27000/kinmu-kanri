// ---- データ管理 ----
const DB = {
  get punches() { return JSON.parse(localStorage.getItem('wt_punches') || '[]'); },
  set punches(v) { localStorage.setItem('wt_punches', JSON.stringify(v)); },
  get shifts() { return JSON.parse(localStorage.getItem('wt_shifts') || '[]'); },
  set shifts(v) { localStorage.setItem('wt_shifts', JSON.stringify(v)); },
  // 基本時給（デフォルト）
  get hourlyRate() { return parseInt(localStorage.getItem('wt_hourly_rate') || '0'); },
  set hourlyRate(v) { localStorage.setItem('wt_hourly_rate', String(v)); },
  // 交通費（1日あたり）
  get transportFee() { return parseInt(localStorage.getItem('wt_transport_fee') || '0'); },
  set transportFee(v) { localStorage.setItem('wt_transport_fee', String(v)); },
  // 有給管理
  get hireDate()    { return localStorage.getItem('wt_hire_date') || ''; },
  set hireDate(v)   { localStorage.setItem('wt_hire_date', v); },
  get weeklyDays()  { return parseInt(localStorage.getItem('wt_weekly_days') || '5'); },
  set weeklyDays(v) { localStorage.setItem('wt_weekly_days', String(v)); },
  get leaveUsed()   { return JSON.parse(localStorage.getItem('wt_leave_used') || '[]'); },
  set leaveUsed(v)  { localStorage.setItem('wt_leave_used', JSON.stringify(v)); },
  // 月別時給 { "2026-01": 1100, "2026-03": 1200, ... }
  get hourlyRates() { return JSON.parse(localStorage.getItem('wt_hourly_rates') || '{}'); },
  set hourlyRates(v) { localStorage.setItem('wt_hourly_rates', JSON.stringify(v)); },
  // ym (例: "2026-04") の時給を返す。月別設定 → 基本時給 の順でフォールバック
  getRate(ym) {
    if (!ym) return this.hourlyRate;
    const rates = this.hourlyRates;
    return rates[ym] ?? this.hourlyRate;
  },
};

