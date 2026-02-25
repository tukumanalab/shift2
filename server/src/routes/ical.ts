import express from 'express';
import { ICalService } from '../services/ICalService';

const router = express.Router();

function validateToken(req: express.Request, res: express.Response): boolean {
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
  res.setHeader('Content-Disposition', 'attachment; filename="shifts.ics"');
  res.setHeader('Cache-Control', 'max-age=900');
  res.send(icsContent);
}

/**
 * GET /api/ical/all?token=<token>
 * 全ユーザーの全シフトを iCal 形式で返す（管理者用）
 */
router.get('/all', (req, res) => {
  if (!validateToken(req, res)) return;
  sendIcal(res, ICalService.generateAll());
});

/**
 * GET /api/ical/user/:user_id?token=<token>
 * 特定ユーザーのシフトを iCal 形式で返す
 */
router.get('/user/:user_id', (req, res) => {
  if (!validateToken(req, res)) return;
  const userId = req.params.user_id as string;
  sendIcal(res, ICalService.generateForUser(userId));
});

export default router;
