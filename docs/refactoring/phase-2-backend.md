# Phase 2: バックエンド構造の整理

**ゴール**: `server/src` の定型重複を排除し、CalendarService を責務単位に分割して、変更コストと不具合混入リスクを下げる。

**前提**: Phase 1 完了（統合テストが安全網として存在する）

## 背景（2026-06-11 調査）

- ルート層: try/catch + `console.error` + `res.status(500).json({success:false, error:'サーバーエラーが発生しました'})` の定型が 37 箇所、`res.status(500)` は 49 箇所。
- モデル層: 5 クラス約 1,050 行のうち、try/catch → `console.error` → デフォルト値 return の同型メソッドが約 48 個。
- `CalendarService.ts`（863 行）: 同期・削除・リトライ・表示名・イベント構築・クリーンアップ・直列化キューの 16 責務が同居。`doSyncShiftsForUserAndDate` と `doSyncSpecialShiftApplicationsForUserAndDate` は約 100 行ずつほぼ同一構造。
- SQL がルート層（shifts.ts:431）と CalendarService（7 箇所）に直書きされ、モデル層を迂回。
- `"HH:MM-HH:MM"` のパース・組み立てが 16 箇所に散在し、バリデーションなし。
- `db.ts` のマイグレーションが「try/catch で ALTER TABLE して全エラーを握りつぶす」方式（db.ts:84-102）。
- `error: any` などの any が約 23 箇所。

## 作業項目

### 2-1. ルート層: エラーハンドリングの一元化（PR 1 本）

- [ ] `asyncHandler`（async ルートの例外を next へ流すラッパー）と、共通エラーミドルウェア（ログ + 500 応答）を導入
- [ ] 各ルートの try/catch 定型を撤去し、正常系のみ残す（404/400/409 などの業務分岐は残す）
- [ ] 既存ルートテストが応答仕様（status / body 形状）の不変を保証していることを確認してから着手

**効果目安**: ルート層から重複 catch 約 37 ブロック（300 行前後）を削減。

### 2-2. ルート層: バリデーションヘルパー（PR 1 本）

- [ ] `requireFields(req.body, ['user_id', 'user_name', ...])` 形式の共通ヘルパーで「必須フィールドが不足しています」系の分岐を統一
- [ ] 日付形式（YYYY-MM-DD）・time_slot 形式の検証を共通化（2-5 の時刻ユーティリティを利用）

### 2-3. モデル層: 共通化（PR 1〜2 本）

- [ ] try/catch + ログ + デフォルト値の定型を `safeQuery(label, fn, fallback)` 的なヘルパー、または基底クラスに抽出
- [ ] 「ほぼ同一の getAll / getByUuid / delete / deleteMultiple」をテーブル名・型パラメータで共通化できるか検討。**過度な抽象化はしない**（共通化は同型 3 クラス以上に現れるメソッドのみ対象）
- [ ] shifts.ts:431 の `UPDATE shifts SET calendar_event_id = NULL ...` をモデルメソッド（`ShiftModel.clearCalendarEventId`）へ移動

### 2-4. CalendarService の分割（PR 2〜3 本）

責務を以下に分割する（ファイル名は例）:

| 新ファイル | 持っていくもの |
|------------|----------------|
| `services/calendar/CalendarGateway.ts` | Google API 呼び出し（insert/delete/list）、`withRetry`、`deleteCalendarEvent` |
| `services/calendar/EventBuilder.ts` | `getDisplayName`、`parseTimeSlot`、`buildEventData` |
| `services/calendar/SyncService.ts` | `runSerialized` キュー、ユーザー×日付の同期（通常/特別） |
| `services/calendar/MaintenanceService.ts` | `syncAllShifts`、`deleteAllEvents`、`cleanAndResyncDate`、`getSyncStatus` |

- [ ] 分割ステップ 1: 上記クラスへ移動し、既存 `CalendarService` は委譲だけ残す（呼び出し元・テスト不変のまま green を確認）
- [ ] 分割ステップ 2: `doSyncShiftsForUserAndDate` / `doSyncSpecialShiftApplicationsForUserAndDate` の共通骨格（既存イベント削除 → ID クリア → マージ → 作成 → リンク）を 1 つのテンプレートメソッドに統合し、「対象レコードの取得」「ID クリア SQL」「イベント summary 生成」だけを差し替え可能にする
- [ ] 分割ステップ 3: 呼び出し元を新クラス直接参照に切り替え、委譲シェルを削除
- [ ] CalendarService 内の直書き SQL（calendar_event_id クリア 7 箇所）をモデルメソッドへ移動

**注意**: 直列化キュー（orphan イベント防止、`CalendarServiceSyncSerialization.test.ts`）の挙動を壊さないこと。分割の各ステップでこのテストが green であることを必ず確認する。

### 2-5. 時刻ユーティリティの統一（PR 1 本）

- [ ] `utils/timeSlot.ts` を新設: `parseTimeSlot(slot): {start, end}`、`formatTimeSlot(start, end)`、形式バリデーション（`HH:MM-HH:MM` 正規表現）
- [ ] `timeSlotMerger.ts`・`EventBuilder`・ルート層の `split('-')` 直書き（計 16 箇所）を置換
- [ ] 不正形式入力時の挙動（throw か null か）をテストで固定

### 2-6. マイグレーション方式の整理（PR 1 本）

- [ ] `PRAGMA user_version` ベースの順次マイグレーションランナーを導入（`migrations/001-add-name.sql` … と適用済みバージョン管理）
- [ ] 既存の try/catch ALTER TABLE 3 箇所をマイグレーションファイル化。**既存本番 DB に対して冪等であること**（適用済み列があっても壊れない初期バージョン判定）をテストで保証
- [ ] 本番適用手順（バックアップ → デプロイ → 起動時自動適用）を `docs/VPS_SETUP.md` に追記

### 2-7. 型の整理（PR 1 本）

- [ ] catch 節の `error: any` を `unknown` + 型ガード（または共通の `toErrorMessage(error)`）に置換（約 23 箇所）
- [ ] ルート・サービス内のインライン行型（`as Array<{...}>`）を `types/` の共有型に寄せる
- [ ] `tsconfig.json` で `noImplicitAny` 等の厳格化が可能か確認し、可能なら有効化

## リスクと対策

| リスク | 対策 |
|--------|------|
| エラーミドルウェア化で応答形状が変わり、フロントが壊れる | 既存ルートテストの応答アサーションを変更しないことを PR レビュー条件にする |
| CalendarService 分割中に同期の直列化が外れて orphan イベント再発 | 各ステップで `CalendarServiceSyncSerialization.test.ts` green を必須化。委譲を挟む 3 ステップ方式で一度に動かさない |
| マイグレーションランナーが既存本番 DB と衝突 | 「列が既に存在する DB」を再現した統合テストを先に書く。本番適用前に `scripts/backup-db.sh` 実施を手順化 |
| モデル共通化のやり過ぎで可読性低下 | 「3 クラス以上に同型」のものだけ共通化。1 箇所でも特殊化が必要ならコピーのまま残してよい |

## 完了条件（Definition of Done）

- ルート層に try/catch 定型が残っていない（業務分岐の早期 return は除く）
- `CalendarService.ts` 単体が 300 行以下、または責務別ファイルに解体済み
- SQL がモデル層（およびマイグレーション）以外に存在しない
- `split('-')` による time_slot 直接パースが `utils/timeSlot.ts` 以外に存在しない
- 全テスト green、統合テスト含む
