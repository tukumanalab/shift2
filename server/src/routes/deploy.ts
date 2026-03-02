import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';

const router = Router();
const SCRIPT_PATH = path.resolve(__dirname, '../../../scripts/deploy.sh');

router.post('/', (req, res) => {
  if (!process.env.DEPLOY_SECRET) {
    return res.status(503).json({ success: false, error: 'Deploy not configured' });
  }
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== process.env.DEPLOY_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const child = spawn('bash', [SCRIPT_PATH], {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  child.unref();

  res.json({ success: true, message: 'デプロイを開始しました' });
});

export default router;
