import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import matchesRouter from './routes/matches';
import authRouter from './routes/auth';
import userRouter from './routes/user';
import adminRouter from './routes/admin';
import seedRouter from './routes/seed';
import groupsRouter from './routes/groups';
import { syncMatches, processFinishedMatches } from './services/footballApi';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const prisma = new PrismaClient();
const app = express();

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    await execAsync('npx prisma db push --accept-data-loss');
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/matches', matchesRouter);
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/admin', adminRouter);
app.use('/api/seed', seedRouter);
app.use('/api/groups', groupsRouter);

app.post('/api/sync', async (req, res) => {
  try {
    await syncMatches();
    res.json({ message: 'Sync completed' });
  } catch (error) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

app.post('/api/reset-db', async (req, res) => {
  try {
    console.log('Resetting database...');
    await execAsync('npx prisma migrate reset --force');
    console.log('Database reset complete');
    res.json({ message: 'Database reset complete' });
  } catch (error) {
    console.error('Reset failed:', error);
    res.status(500).json({ error: 'Reset failed', details: String(error) });
  }
});

setInterval(async () => {
  try {
    await processFinishedMatches();
  } catch (error) {
    console.error('Background processing error:', error);
  }
}, 60000);

setInterval(async () => {
  const now = new Date();
  const hour = now.getUTCHours();
  if (hour === 0) {
    try {
      const [users, matches, predictions] = await Promise.all([
        prisma.user.findMany({ select: { id: true, name: true, email: true, image: true, points: true, isAdmin: true, createdAt: true } }),
        prisma.match.findMany(),
        prisma.prediction.findMany({ select: { id: true, userId: true, matchId: true, homeScore: true, awayScore: true, points: true, bonus: true, createdAt: true } })
      ]);

      const backup = {
        version: '1.0',
        timestamp: now.toISOString(),
        data: { users, matches, predictions }
      };

      const fs = require('fs');
      const date = now.toISOString().split('T')[0];
      const dir = '/app/backups';

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filePath = `${dir}/quiniela-${date}.json`;
      fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));

      console.log(`[BACKUP] Saved to ${filePath} - Users: ${users.length}, Matches: ${matches.length}, Predictions: ${predictions.length}`);

      const files = fs.readdirSync(dir);
      if (files.length > 7) {
        const oldest = files.sort()[0];
        fs.unlinkSync(`${dir}/${oldest}`);
        console.log(`[BACKUP] Deleted old backup: ${oldest}`);
      }
    } catch (error) {
      console.error('[BACKUP] Error:', error);
    }
  }
}, 3600000);

const PORT = parseInt(process.env.PORT || '3001');

async function start() {
  await runMigrations();
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();