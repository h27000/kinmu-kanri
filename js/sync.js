// ---- クラウド同期 (GitHub Gist) ----
const SYNC = {
  BASE: 'https://api.github.com/gists',
  get key()   { return localStorage.getItem('wt_jb_key') || ''; },
  set key(v)  { localStorage.setItem('wt_jb_key', v); },
  get bin()   { return localStorage.getItem('wt_jb_bin') || ''; },
  set bin(v)  { localStorage.setItem('wt_jb_bin', v); },
  get ready() { return !!(this.key && this.bin); },

  headers() {
    return {
      'Authorization': `token ${this.key}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  },

  // Gistがなければ新規作成（現在のDBデータをアップロード）
  _justCreated: false,
  async ensureBin() {
    if (this.bin) return true;
    try {
      // 現在のDBデータを初期コンテンツとして使う
      const currentData = JSON.stringify({
        punches: DB.punches, shifts: DB.shifts, hourlyRate: DB.hourlyRate,
        hourlyRates: DB.hourlyRates, transportFee: DB.transportFee,
        hireDate: DB.hireDate, leaveUsed: DB.leaveUsed,
      });
      const res = await fetch(this.BASE, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          description: 'TimeKeeper データ',
          public: false,
          files: { 'timekeeper-data.json': { content: currentData } },
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || JSON.stringify(d));
      this.bin = d.id;
      this._justCreated = true; // 新規作成フラグ（pullをスキップするため）
      return true;
    } catch(e) { console.warn('ensureBin failed:', e.message); return false; }
  },

  // クラウドからデータを取得してlocalStorageを上書き
  async pull() {
    if (!this.key) return false;
    if (!(await this.ensureBin())) return false;
    try {
      const res = await fetch(`${this.BASE}/${this.bin}`, { headers: this.headers() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || JSON.stringify(d));
      const content = d.files?.['timekeeper-data.json']?.content;
      if (!content) return false;
      const data = JSON.parse(content);
      if (Array.isArray(data.punches)) localStorage.setItem('wt_punches', JSON.stringify(data.punches));
      if (Array.isArray(data.shifts))  localStorage.setItem('wt_shifts',  JSON.stringify(data.shifts));
      if (data.hourlyRate !== undefined) localStorage.setItem('wt_hourly_rate', String(data.hourlyRate));
      if (data.hourlyRates && typeof data.hourlyRates === 'object') localStorage.setItem('wt_hourly_rates', JSON.stringify(data.hourlyRates));
      if (data.transportFee !== undefined) localStorage.setItem('wt_transport_fee', String(data.transportFee));
      if (data.hireDate)   localStorage.setItem('wt_hire_date',   data.hireDate);
      if (Array.isArray(data.leaveUsed)) localStorage.setItem('wt_leave_used', JSON.stringify(data.leaveUsed));
      return true;
    } catch(e) { console.warn('pull failed:', e); return false; }
  },

  // localStorageのデータをクラウドに送信
  async push() {
    if (!this.key) return;
    if (!(await this.ensureBin())) return;
    fetch(`${this.BASE}/${this.bin}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({
        files: { 'timekeeper-data.json': { content: JSON.stringify({
          punches: DB.punches, shifts: DB.shifts, hourlyRate: DB.hourlyRate,
          hourlyRates: DB.hourlyRates, transportFee: DB.transportFee,
          hireDate: DB.hireDate, leaveUsed: DB.leaveUsed,
        }) } },
      }),
    }).catch(e => console.warn('push failed:', e));
  },
};

