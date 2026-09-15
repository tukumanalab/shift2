import express from 'express';
import { ICalService } from '../services/ICalService';
import { deriveUserIcalToken, verifyUserIcalToken } from '../utils/icalToken';

const router = express.Router();

/**
 * 管理者用トークン（ICAL_TOKEN そのもの）を検証する
 * 全ユーザー分のシフトを返すエンドポイントでのみ使用する
 */
function validateAdminToken(req: express.Request, res: express.Response): boolean {
  const token = process.env.ICAL_TOKEN;
  if (!token) {
    res.status(503).json({ error: 'ICAL_TOKEN が設定されていません' });
    return false;
  }
  if (req.query.token !== token) {
    res.status(401).json({ error: '認証トークンが無効です' });
    return false;
  }
  return true;
}

function sendIcal(res: express.Response, icsContent: string): void {
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  // カレンダーアプリからの購読を想定しているため inline で返す
  res.setHeader('Content-Disposition', 'inline; filename="shifts.ics"');
  res.setHeader('Cache-Control', 'max-age=900');
  res.send(icsContent);
}

/**
 * GET /api/ical/all?token=<ICAL_TOKEN>
 * 全ユーザーの全シフトを iCal 形式で返す（管理者用）
 */
router.get('/all', (req, res) => {
  if (!validateAdminToken(req, res)) return;
  sendIcal(res, ICalService.generateAll());
});

/**
 * 認可メールアドレス（管理者）かどうかを判定する
 */
function isAuthorizedEmail(email: unknown): boolean {
  if (typeof email !== 'string' || email === '') return false;

  const authorized = (process.env.AUTHORIZED_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e !== '');

  return authorized.includes(email.trim().toLowerCase());
}

/**
 * GET /api/ical/all-url?email=<管理者のメールアドレス>
 * 管理者用（全シフト）の購読URLを返す
 */
router.get('/all-url', (req, res) => {
  if (!isAuthorizedEmail(req.query.email)) {
    res.status(403).json({ success: false, error: '管理者権限が必要です' });
    return;
  }

  const token = process.env.ICAL_TOKEN;
  if (!token) {
    res.status(503).json({ success: false, error: 'ICAL_TOKEN が設定されていません' });
    return;
  }

  res.json({ success: true, data: { url: `/api/ical/all?token=${token}` } });
});

/**
 * GET /api/ical/my-url?userId=<user_id>
 * ログインユーザー本人の購読URLを返す
 */
router.get('/my-url', (req, res) => {
  const userId = req.query.userId;
  if (typeof userId !== 'string' || userId === '') {
    res.status(400).json({ success: false, error: 'userId が指定されていません' });
    return;
  }

  const token = deriveUserIcalToken(userId);
  if (!token) {
    res.status(503).json({ success: false, error: 'ICAL_TOKEN が設定されていません' });
    return;
  }

  res.json({
    success: true,
    data: { url: `/api/ical/user/${encodeURIComponent(userId)}?token=${token}` },
  });
});

/**
 * GET /api/ical/user/:user_id?token=<ユーザー個別トークン>
 * 特定ユーザーのシフトを iCal 形式で返す
 * トークンは user_id と対でのみ有効（他人の user_id には使えない）
 */
router.get('/user/:user_id', (req, res) => {
  if (!process.env.ICAL_TOKEN) {
    res.status(503).json({ error: 'ICAL_TOKEN が設定されていません' });
    return;
  }

  const userId = req.params.user_id as string;
  if (!verifyUserIcalToken(userId, req.query.token)) {
    res.status(401).json({ error: '認証トークンが無効です' });
    return;
  }

  sendIcal(res, ICalService.generateForUser(userId));
});

export default router;
