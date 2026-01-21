import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import usersRouter from './routes/users';
import specialShiftsRouter from './routes/specialShifts';
import shiftsRouter from './routes/shifts';
import capacitySettingsRouter from './routes/capacitySettings';
import calendarRouter from './routes/calendar';

// 環境変数を読み込む
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(cors());
app.use(express.json());

// APIルーティング（静的ファイルより前に配置）
app.use('/api/users', usersRouter);
app.use('/api/special-shifts', specialShiftsRouter);
app.use('/api/shifts', shiftsRouter);
app.use('/api/capacity-settings', capacitySettingsRouter);
app.use('/api/calendar', calendarRouter);

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// 静的ファイルの提供（プロジェクトルート）
const staticPath = path.join(__dirname, '../..');
console.log(`📁 Serving static files from: ${staticPath}`);
app.use(express.static(staticPath));

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`📊 API endpoints:`);
  console.log(`   - GET    /health`);
  console.log(`   - POST   /api/users`);
  console.log(`   - GET    /api/users`);
  console.log(`   - GET    /api/users/:userId`);
  console.log(`   - GET    /api/users/:userId/profile`);
  console.log(`   - PUT    /api/users/:userId/profile`);
  console.log(`   - DELETE /api/users/:userId`);
  console.log(`   - GET    /api/special-shifts`);
  console.log(`   - GET    /api/special-shifts/:uuid`);
  console.log(`   - POST   /api/special-shifts`);
  console.log(`   - DELETE /api/special-shifts/:uuid`);
  console.log(`   - POST   /api/special-shifts/delete-multiple`);
  console.log(`   - GET    /api/shifts`);
  console.log(`   - GET    /api/shifts/counts`);
  console.log(`   - GET    /api/shifts/:uuid`);
  console.log(`   - POST   /api/shifts`);
  console.log(`   - POST   /api/shifts/multiple`);
  console.log(`   - POST   /api/shifts/check-duplicate`);
  console.log(`   - POST   /api/shifts/check-multiple-duplicates`);
  console.log(`   - DELETE /api/shifts/:uuid`);
  console.log(`   - POST   /api/shifts/delete-multiple`);
  console.log(`   - GET    /api/capacity-settings`);
  console.log(`   - GET    /api/capacity-settings/:date`);
  console.log(`   - POST   /api/capacity-settings`);
  console.log(`   - POST   /api/capacity-settings/bulk`);
  console.log(`   - PUT    /api/capacity-settings/:date`);
  console.log(`   - DELETE /api/capacity-settings/:date`);
  console.log(`   - POST   /api/calendar/sync`);
  console.log(`   - POST   /api/calendar/sync-shift`);
  console.log(`   - DELETE /api/calendar/sync-shift/:shiftUuid`);
  console.log(`   - GET    /api/calendar/sync-status`);
});

export default app;
