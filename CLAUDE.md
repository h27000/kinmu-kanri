# TimeKeeper — AI開発ガイドライン

## プロジェクト概要
勤務時間管理PWA。打刻・シフト・給与計算・有給管理・年間集計を1つのHTMLファイルで提供する。

## アーキテクチャ

### ファイル構成
- `index.html` — メインアプリ（HTML + CSS + JS すべて含む）
- `sw.js` — Service Worker（オフラインキャッシュ v3）
- `manifest.json` — PWA設定
- `spreadsheet.gs` — Google Apps Script（Googleスプレッドシート連携）
- `icon-192.png` / `icon-512.png` — PWAアイコン

### データ管理
- ストレージ: localStorage（キー一覧は index.html 内 DB オブジェクト参照）
- クラウド同期: GitHub Gist API（3分ごと自動pull）
- バックアップ: 自動（7日分）+ 手動JSON

### 主要な計算ロジック
- 給与計算: 実働時間ベース、8時間超は×1.25倍残業割増
- 有給: 労基法比例付与テーブル準拠
- 休憩自動計算: 7時間以上=60分、未満=0分

## 開発ルール

### やってはいけないこと
- GitHub Gist APIトークンをコードに直書きしない（設定画面から入力、localStorageに保存）
- Googleスプレッドシートのシートキーをコードに直書きしない（spreadsheet.gs内のSS_IDは変更しない）
- Service Worker のキャッシュバージョン（CACHE_NAME）を変更する際は必ず `sw.js` も更新する

### UI原則
- スマホ最優先（iPhone Safari / Android Chrome）
- テーブルの横スクロールは禁止（列を削る・折り返しで対応）
- 日曜=赤、土曜=青で色付け統一
- 数値の先頭ゼロは削除（04 → 4）
- 時間表示は h:mm 形式（3.9h ではなく 3:51）

### コミット規則
- 日本語でシンプルに（例: `月セレクターに未来3ヶ月を追加`）
- PRを使わず main への直接コミットでOK（小規模プロジェクトのため）

## よく触るコードの場所（index.html内）

| 機能 | キーワード検索 |
|------|--------------|
| 打刻ロジック | `punchIn`, `punchOut` |
| 給与計算 | `calcWage` |
| 有給管理 | `leaveUsed`, `hireDate` |
| クラウド同期 | `SYNC`, `gistId` |
| Service Worker登録 | `navigator.serviceWorker` |

## 注意事項
- index.html は2600行超のモノリシック構成。大きな変更は影響範囲に注意
- PWAとしてインストール済みのユーザーへの影響を考慮する
- クラウド同期はGitHub Gist（JSONBin.ioからの移行済み）
