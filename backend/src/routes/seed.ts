import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.post('/seed', async (req: Request, res: Response) => {
  try {
    const adminEmail = req.body.email || 'admin@quiniela.com';
    const adminPassword = req.body.password || 'admin123';

    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    
    if (existingAdmin) {
      res.json({ message: 'Admin already exists', email: adminEmail });
      return;
    }

    const hashedPassword = Buffer.from(adminPassword).toString('base64');

    const admin = await prisma.user.create({
      data: {
        name: 'Administrador',
        email: adminEmail,
        password: hashedPassword,
        isAdmin: true
      }
    });

    res.json({ 
      message: 'Admin created', 
      email: adminEmail, 
      password: adminPassword,
      id: admin.id
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Seed failed' });
  }
});

router.post('/seed-matches', async (req: Request, res: Response) => {
  try {
    const matches = [
      {
        externalId: 'match-001',
        homeTeam: 'Argentina',
        homeFlag: 'ar',
        awayTeam: 'Brazil',
        awayFlag: 'br',
        startTime: new Date(Date.now() + 86400000),
        groupStage: 'Final'
      },
      {
        externalId: 'match-002',
        homeTeam: 'France',
        homeFlag: 'fr',
        awayTeam: 'Germany',
        awayFlag: 'de',
        startTime: new Date(Date.now() + 172800000),
        groupStage: 'Semifinal'
      },
      {
        externalId: 'match-003',
        homeTeam: 'Spain',
        homeFlag: 'es',
        awayTeam: 'England',
        awayFlag: 'gb',
        startTime: new Date(Date.now() + 259200000),
        groupStage: 'Cuartos'
      }
    ];

    for (const match of matches) {
      await prisma.match.upsert({
        where: { externalId: match.externalId },
        update: match,
        create: match
      });
    }

    res.json({ message: `${matches.length} matches created` });
  } catch (error) {
    res.status(500).json({ error: 'Seed matches failed' });
  }
});

export default router;