# Phase 0: リポジトリ衛生とドキュメント整合

**ゴール**: 挙動を一切変えずに、誤った情報源・無意味なファイル・設定の矛盾を排除する。以降のフェーズで人（と AI エージェント）が古い情報に騙されない状態を作る。

**前提**: なし（いつでも着手可能）

## 背景

- `CLAUDE.md` の「アーキテクチャ」「Google OAuth 設定」節は初期のスタティック SPA 時代の記述のまま（CLAUDE.md:175-181 の「認可済みオリジン: localhost:8081」「Client ID は index.html と app.js にハードコード」等）。現在は Express がポート 3000 で配信し、Client ID は `/api/config` から実行時取得（js/modules/config.js）であり、事実と異なる。
- `playwright.config.ts:11` の `baseURL: 'http://localhost:8080'` が開発サーバー（3000）と不一致。
- `.serena/` （外部 AI ツールの設定）が git 追跡されている。
- `app.js`・`js/modules/shiftRequest.js` 等に旧 UI のデッドコードが残存。

## 作業項目

### 0-1. CLAUDE.md / README.md の実態同期（PR 1 本）

- [ ] CLAUDE.md の「アーキテクチャ」節（ファイル構成・認証フロー・Google OAuth 設定）を現構成に書き換える
  - ファイル構成: `index.html` + `js/modules/*.js`（16 ファイル）+ `server/src`（Express + TS）
  - Client ID: `.env` → `/api/config` → `config.js` の実行時取得フローを記載
  - ポートは 3000 に統一（8081 への言及を全削除）
- [ ] 「実装上のポイント」節の `decodeJwtResponse` / `#loginSection` 等の記述が現コードと一致するか検証し、ずれていれば修正
- [ ] README.md のセットアップ手順を一読し、現在の `npm run dev` フローと一致させる
- [ ] CLAUDE.md の「フロントエンドテストの慣習」節に「Phase 1 で実コード import 方式へ移行予定」と注記（Phase 1 完了時に節ごと書き換え）

**受け入れ条件**: ドキュメント内の全ポート番号・全ファイルパスが実在のものと一致する。

### 0-2. 設定ファイルの矛盾解消・不要ファイル削除（PR 1 本）

- [ ] `playwright.config.ts` の `baseURL` をサーバー実ポートに合わせる（`webServer` にも `port` を明示）
- [ ] `.serena/` を git 追跡から外す（`git rm -r --cached .serena` + `.gitignore` 追加）。チームで Serena を使っていないなら削除
- [ ] `codecov.yml` / `jest.config.ts` のカバレッジ閾値に「現状値は暫定。Phase 5 で引き上げ」のコメントを付ける（数値変更は Phase 5）
- [ ] `.github/workflows/test.yml` の backend-tests ステップの `|| echo "Backend tests not yet configured"` を削除（バックエンドテストは既に 154 件存在しており、失敗の握りつぶしは危険）

**受け入れ条件**: CI が green のまま。`git ls-files | grep .serena` が空。

### 0-3. 明白なデッドコードの削除（PR 1 本）

削除前に**全ファイル grep で参照ゼロを確認し、その証跡を PR 説明に記載**する。

- [ ] `js/modules/shiftRequest.js` の旧 UI 関数群: `openShiftRequestModal`（:177）、`updateTimeSlotCapacity`（:205）、`generateTimeSlots`（:253）、`shiftRemarks` 参照（:311）— HTML 側に対応要素がないことを確認の上削除
- [ ] `index.html` の `display:none` で恒久的に隠されているタブ（:2751, :2753 付近）が本当に不要か確認し、不要なら HTML・関連 JS ごと削除
- [ ] `server/src/services/CalendarService.ts` の後方互換ラッパー: `addShiftToCalendar`（単なる委譲）、`deleteShiftFromCalendar`（コメントに「後方互換性のために残されています」）— 呼び出し元ゼロを確認して削除
- [ ] 上記削除で参照が消えるテスト（コピー実装をテストしているもの）も同時に削除

**受け入れ条件**: 全テスト green。手動スモーク（ログイン → 申請 → 一覧 → キャンセル）が通る。

## リスクと対策

| リスク | 対策 |
|--------|------|
| 「デッドコード」が実は動的参照されている（`onclick="..."` 文字列内など） | grep は関数名の文字列一致で行い、`index.html`・`help.html` の属性値も対象に含める |
| `.serena` 削除が他メンバーの環境を壊す | 追跡から外すだけにし、ローカルファイルは残す（`--cached`） |

## 完了条件（Definition of Done)

- CLAUDE.md / README.md / 各種設定のポート・パス・手順がすべて実態と一致
- 旧 UI デッドコードと後方互換ラッパーが削除され、全テスト green
- CI でバックエンドテストの失敗が正しく fail として扱われる
