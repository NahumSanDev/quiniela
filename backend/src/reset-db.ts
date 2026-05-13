import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function resetAndMigrate() {
  try {
    console.log('Resetting database...');
    await execAsync('npx prisma migrate reset --force --skip-generate');
    console.log('Applying migrations...');
    await execAsync('npx prisma migrate deploy');
    await execAsync('npx prisma generate');
    console.log('Database reset complete');
  } catch (error) {
    console.error('Reset failed:', error);
  }
}

resetAndMigrate();