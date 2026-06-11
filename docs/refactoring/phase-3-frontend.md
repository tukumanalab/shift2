# Phase 3: フロントエンド構造の整理

**ゴール**: `js/modules/` の重複・グローバル依存・API 呼び出しの不統一を解消し、最終的に ES modules へ移行する。

**前提**: Phase 1 完了（フロントテストが実コードを import しており、変更を検知できる）

## 背景（2026-06-11 調査）

- 「モジュール」と言いつつ ES modules ではなく、`index.html:2980-3004` の `<script>` タグ 17 本の読み込み順にすべてが依存。関数・状態はグローバル空間で共有。
- 重複関数: `timeToMinutes` が `shifts.js:581` と `shiftRequest.js:923`（NaN チェック有無で実装差あり）、`mergeShiftsByPerson` が `utils.js:226` と `calendar.js:529`、日付フォーマット関数が 4 種類分散（`utils.js` に 3 つ + `workRecords.js:49`）。
- 状態の二重管理: `AppState` オブジェクトと `window.currentUser`（state.js:38）、`window.allShiftsData`（state.js:128）、`window.capacityData`（capacity.js:22）、`window.currentCapacityData`（shiftRequest.js:30）が混在。
- API 呼び出し: `api.js` に 23 メソッドある一方、`auth.js:31`、`capacity.js:58`（`API.getCapacitySettings` と重複）、`capacity.js:83`、`shiftRequest.js:68`、`config.js:20`、`workRecords.js:152`、`userProfile.js:176` の 7 箇所が直接 `fetch`。
- `index.html` にインライン `onclick` が 20 箇所。`app.js` は管理者向けカレンダー操作 3 関数 + エントリーポイントが残った状態。

## 作業項目

### 3-1. 重複ヘルパーの統一（PR 1 本）

- [ ] `timeToMinutes` を `utils.js` に一本化（NaN チェック付きの `shiftRequest.js` 版を正とする）。両ファイルのローカル定義を削除
- [ ] `mergeShiftsByPerson` の 2 実装を diff し、同一なら `utils.js` 版へ統一。差分があれば挙動差をテストで固定してから統一
- [ ] 日付フォーマット 4 関数を `utils.js` に集約し、`workRecords.js:49` の独自実装を置換
- [ ] Phase 1 のテストを実コード import に切り替えてあるため、統一後の関数にテストが追随していることを確認

### 3-2. API アクセスの一元化（PR 1〜2 本)

- [ ] 直接 `fetch` 7 箇所を `api.js` のメソッド呼び出しに置換（不足メソッドは `api.js` に追加）
- [ ] `capacity.js:58` のように既存 API メソッドと重複しているものは単純置換
- [ ] `api.js` 内のエラーハンドリング（HTTP エラー時の戻り値形状）を 1 パターンに統一し、呼び出し側の分岐を簡素化
- [ ] 例外: `config.js:20` の初期設定取得は bootstrap 段階のため `api.js` 依存にしない判断もあり得る。判断結果をコードコメントに残す

### 3-3. 状態管理の一元化（PR 1 本）

- [ ] `window.*` 直接代入（4 箇所＋参照側）を `state.js` の getter/setter 経由に統一
- [ ] `state.js` に存在しない状態（`capacityData` 等）は追加してから移行
- [ ] 移行後、`grep -rn "window\." js/` で残存を確認（`window.location` 等の正当な利用は除く）

### 3-4. インライン onclick の排除（PR 1 本）

- [ ] `index.html` の `onclick` 20 箇所を `addEventListener` 登録（各モジュールの init 関数内）に移行
- [ ] これにより関数をグローバル公開する必要がなくなり、3-5 の ES modules 化が可能になる

### 3-5. ES modules への移行（PR 1〜2 本）

- [ ] `js/modules/*.js` に `export` を付け、Phase 1 で入れた CommonJS ガードを削除（Jest 側は ESM 対応設定 or babel 変換に切り替え）
- [ ] `index.html` の `<script>` タグ 17 本を `<script type="module" src="js/main.js">` 1 本に置換し、`main.js` で import 順を明示
- [ ] `app.js` の残存関数（`syncAllShiftsToCalendar` 等の管理者カレンダー操作 3 つ）を `js/modules/adminCalendar.js` として移設し、エントリーポイント処理は `main.js` に統合。`app.js` を削除
- [ ] 読み込み順依存が消えたことを確認（モジュール間依存はすべて import 文で表現）

### 3-6. 大型モジュールの分割（PR 1 本、任意）

- [ ] `shiftRequest.js`（1,044 行）を「日付詳細モーダル」「申請送信」「容量表示」に分割
- [ ] `shifts.js`（787 行）・`calendar.js`（735 行）も同様に、表示とデータ整形を分離

## リスクと対策

| リスク | 対策 |
|--------|------|
| ES modules 化はビッグバンになりやすい | 3-1〜3-4 を先に終わらせ、グローバル依存を減らした最後に 3-5 を実施。3-5 だけは 1 PR で全ファイル一括切り替え（中途半端な混在が最も危険） |
| `onclick` → listener 移行でイベント登録漏れ | 移行対象 20 箇所をチェックリスト化し、E2E/手動スモークで全ボタンを踏む |
| 直接 fetch の置換でエラー時の挙動が変わる | 置換前に各呼び出しのエラー分岐（alert 表示等）を確認し、`api.js` メソッドが同じ情報を返すことをテストで確認 |
| GSI（Google Sign-In）コールバックはグローバル関数前提 | `window.handleCredentialResponse = ...` のような明示的なグローバル公開を 1 箇所だけ残し、コメントで理由を明記 |

## 完了条件（Definition of Done)

- 重複ヘルパー関数ゼロ（同名関数の多重定義が grep で検出されない）
- `api.js` 以外に `fetch(` が存在しない（許容した例外を除く）
- `<script>` タグが GSI + エントリーポイントのみ
- `app.js` が削除されている
- 全テスト green、全ボタンの手動スモーク済み
