import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import matchesRouter from './routes/matches';
import authRouter from './routes/auth';
import { syncMatches, processFinishedMatches } from './services/footballApi';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const prisma = new PrismaClient();
const app = express();

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    await execAsync('npx prisma migrate deploy');
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

app.post('/api/sync', async (req, res) => {
  try {
    await syncMatches();
    res.json({ message: 'Sync completed' });
  } catch (error) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

setInterval(async () => {
  try {
    await processFinishedMatches();
  } catch (error) {
    console.error('Background processing error:', error);
  }
}, 60000);

const PORT = parseInt(process.env.PORT || '3001');

async function start() {
  await runMigrations();
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();