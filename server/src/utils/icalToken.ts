import crypto from 'crypto';

/**
 * iCal 購読トークンのユーティリティ
 *
 * 購読URLはカレンダーアプリに貼り付けられ、ユーザーの手元に長く残る。
 * そのため全員で共通のトークンを使うと、URL の user_id を書き換えるだけで
 * 他人のシフトが読めてしまう。ここではサーバー秘密鍵（ICAL_TOKEN）と
 * user_id から HMAC でユーザーごとのトークンを導出し、user_id と対でのみ
 * 有効になるようにする。
 *
 * - DB マイグレーション不要（保存せず、都度導出する）
 * - ICAL_TOKEN を再生成すれば全ユーザーの購読URLを一括失効できる
 */

/**
 * user_id 専用の購読トークンを導出する
 * @returns ICAL_TOKEN が未設定の場合は null
 */
export function deriveUserIcalToken(userId: string): string | null {
  const secret = process.env.ICAL_TOKEN;
  if (!secret) return null;

  return crypto
    .createHmac('sha256', secret)
    .update(`ical-user:${userId}`)
    .digest('base64url');
}

/**
 * user_id とトークンの組み合わせが正しいか検証する
 * タイミング攻撃を避けるため timingSafeEqual で比較する
 */
export function verifyUserIcalToken(userId: string, token: unknown): boolean {
  if (typeof token !== 'string' || token.length === 0) return false;

  const expected = deriveUserIcalToken(userId);
  if (!expected) return false;

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(token);
  // timingSafeEqual は長さが違うと例外を投げるため、先に長さを確認する
  if (expectedBuf.length !== actualBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
