# Phase 1: テスト基盤の再建

**ゴール**: 「テストが実コードを検証している」状態を作り、Phase 2〜4 の構造変更を安全に行える安全網を確立する。

**前提**: Phase 0 完了（デッドコードが消えており、消えたコードのテストを書かずに済む）

## 背景

現在のテストは量（フロント約 5,100 行 + バック約 3,200 行、計 366 件）の割に、リファクタリングの安全網としてほとんど機能しない。

1. **フロントテストは実コードを import していない。** CLAUDE.md 公認の運用として、テストファイル内に「期待挙動を表現するインライン関数」を定義してそれをテストしている（例: `test/special-shift-slots.test.js:18-42` に `buildSpecialShiftSlots` のコピー、`test/special-shift-name.test.js:239-296` に `displayMyShifts` 相当の再実装）。実装側を壊してもテストは緑のまま。
2. **バックテストにも実装を呼ばないテストがある。** `server/src/__tests__/CalendarService.test.ts:56-149` は CalendarService を呼ばず、テスト内のローカル変数やコピー関数を検証している（実質トートロジー）。
3. **ルートテストは全依存モック**（モデル・CalendarService・db）で、HTTP 層の分岐は検証できているが、SQL を含むモデル層の実挙動は未検証。

## 方針

- フロント `js/modules/*.js` を **挙動を変えずに Jest から require 可能**にする。ブラウザ側は従来どおり `<script>` タグで動くよう、各ファイル末尾に CommonJS ガード付きエクスポートを追加する方式を採る（完全な ES modules 化は Phase 3 末で実施。ここでは最小変更に留める）:

  ```js
  // ファイル末尾に追加（ブラウザでは無視される）
  if (typeof module !== 'undefined' && module.exports) {
      module.exports = { buildSpecialShiftSlots, timeToMinutes, minutesToTime };
  }
  ```

- バックエンドは **better-sqlite3 のインメモリ DB（`:memory:`）を使った統合テスト**を導入し、モデル層と「ルート + 実 DB」の縦の検証を可能にする。

## 作業項目

### 1-1. テスト棚卸しと分類（PR 1 本、ドキュメントのみ）

- [ ] 全テストファイルを「A: 実コードを検証」「B: コピー実装を検証（書き換え対象）」「C: トートロジー（削除対象）」に分類し、`docs/refactoring/test-inventory.md` として記録
- [ ] B のテストごとに、対応する実関数（ファイル・関数名）を対応表にする

### 1-2. js/modules にエクスポートガードを追加（PR 1 本）

- [ ] 純粋ロジックを持つモジュールから着手: `utils.js`、`shiftRequest.js`（`buildSpecialShiftSlots`/`timeToMinutes`/`minutesToTime`）、`specialShifts.js`、`state.js`
- [ ] ブラウザ挙動が不変であることを手動スモークで確認（`module` 未定義ガードにより no-op）
- [ ] `jest.config.ts` の frontend プロジェクトで `collectCoverageFrom` に `js/modules/**` を設定（閾値はまだ上げない）

**受け入れ条件**: 既存テスト全 green、ブラウザ動作不変、`require('../js/modules/utils.js')` がテストから成功する。

### 1-3. フロントテストの実コード接続（PR 3〜5 本に分割）

分類 B のテストを 1 ファイル〜数ファイルずつ書き換える。

- [ ] テスト内のコピー実装を削除し、実モジュールの import に置換
- [ ] **置換時に実装とコピーの差分を必ず確認する。** 乖離が見つかった場合はどちらが正かを判断し、バグなら別 PR で TDD 修正（このフェーズの PR に混ぜない）
- [ ] DOM 依存の強い関数（`display*` 系）は、jsdom + `test-utils.js` のフィクスチャで実関数を呼ぶ形に書き換える。書き換えコストが高すぎるものは「E2E でカバーする」と判断して削除し、Phase 5 の E2E 対象リストに追記
- [ ] 分類 C（トートロジー）のテストを削除: `CalendarService.test.ts:56-149` のコピー検証 describe、`test/shift-delete-functions.test.js` の自明 expect 等

**受け入れ条件**: `test/` 配下に実装コピー関数が残っていない（`grep -rn "function buildSpecialShiftSlots\|function mergeConsecutiveTimeSlots" test/` が空）。

### 1-4. バックエンド統合テストの導入（PR 2 本）

- [ ] `server/src/database/db.ts` を「スキーマ定義」と「接続生成」に分離し、テストから `:memory:` DB を注入できるようにする（既存 import 互換の default export は維持）
- [ ] モデル統合テスト: 5 モデルの CRUD を実 SQL で検証（`server/src/__tests__/integration/models.test.ts`）
- [ ] ルート統合テスト: supertest + 実 DB（CalendarService のみモック）で、申請 → 取得 → 削除の代表フローを検証

**受け入れ条件**: モデル層の SQL がテストで実行される（カバレッジで models/ が計測される）。

### 1-5. CLAUDE.md の運用ルール更新（PR 1 本）

- [ ] 「フロントエンドテストの慣習」節を削除し、「テストは実コードを import する。エクスポートガード方式」の新ルールに書き換える
- [ ] 新規テストでコピー実装方式を禁止する旨を明記

## リスクと対策

| リスク | 対策 |
|--------|------|
| コピー実装と実装の乖離が「テスト書き換え」で大量に発覚する | 乖離は発見ごとに記録し、修正はバグ修正 PR として分離。書き換え PR は「実装の現挙動」を正としてテストを合わせる |
| エクスポートガード追加漏れ・タイポでブラウザが壊れる | 追加は機械的な末尾追記のみとし、PR ごとに手動スモーク必須 |
| `db.ts` 分離が本番 DB パスに影響 | default export の生成ロジック（パス解決）は変更せず、関数抽出のみ行う |

## 完了条件（Definition of Done）

- テスト内の実装コピーがゼロ、トートロジーテストがゼロ
- フロントの主要ロジック関数・バックエンドのモデル層がカバレッジ計測に乗っている
- 全テスト green、CI green
