import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import usersRouter from './routes/users';

// 環境変数を読み込む
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(cors());
app.use(express.json());

// ルーティング
app.use('/api/users', usersRouter);

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints:`);
  console.log(`   - GET    /health`);
  console.log(`   - POST   /api/users`);
  console.log(`   - GET    /api/users`);
  console.log(`   - GET    /api/users/:userId`);
  console.log(`   - GET    /api/users/:userId/profile`);
  console.log(`   - PUT    /api/users/:userId/profile`);
  console.log(`   - DELETE /api/users/:userId`);
});

export default app;
