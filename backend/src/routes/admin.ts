import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

export function adminAuth(req: Request, res: Response, next: Function) {
  const adminKey = req.headers['x-admin-key'];
  const validKey = process.env.ADMIN_SECRET || 'admin-secret-key';

  if (adminKey !== validKey) {
    res.status(403).json({ error: 'Acceso denegado' });
    return;
  }
  next();
}

router.get('/matches', adminAuth, async (req: Request, res: Response) => {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { startTime: 'desc' }
    });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/matches', adminAuth, async (req: Request, res: Response) => {
  try {
    const { externalId, homeTeam, homeFlag, awayTeam, awayFlag, startTime, groupStage } = req.body;
    const match = await prisma.match.create({
      data: {
        externalId,
        homeTeam,
        homeFlag,
        awayTeam,
        awayFlag,
        startTime: new Date(startTime),
        groupStage
      }
    });
    res.status(201).json(match);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.put('/matches/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { homeScore, awayScore, status } = req.body;

    const match = await prisma.match.update({
      where: { id: parseInt(id) },
      data: {
        homeScore: homeScore ?? undefined,
        awayScore: awayScore ?? undefined,
        status: status ?? undefined
      }
    });

    if (status === 'FINISHED' && homeScore !== undefined && awayScore !== undefined) {
      const predictions = await prisma.prediction.findMany({
        where: { matchId: parseInt(id), points: 0 }
      });

      for (const prediction of predictions) {
        let points = 0;
        let bonus = false;

        const predictedWinner = prediction.homeScore > prediction.awayScore ? 'HOME' :
                               prediction.awayScore > prediction.homeScore ? 'AWAY' : 'DRAW';
        const actualWinner = homeScore > awayScore ? 'HOME' :
                            awayScore > homeScore ? 'AWAY' : 'DRAW';

        if (predictedWinner === actualWinner) points += 3;
        if (prediction.homeScore === homeScore && prediction.awayScore === awayScore) {
          points += 1;
          bonus = true;
        }

        if (points > 0) {
          await prisma.prediction.update({
            where: { id: prediction.id },
            data: { points, bonus }
          });

          await prisma.user.update({
            where: { id: prediction.userId },
            data: { points: { increment: points } }
          });
        }
      }
    }

    res.json(match);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.delete('/matches/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.match.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.get('/users', adminAuth, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { points: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        points: true,
        createdAt: true,
        _count: { select: { predictions: true } }
      }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.get('/stats', adminAuth, async (req: Request, res: Response) => {
  try {
    const [totalUsers, totalMatches, totalPredictions, finishedMatches] = await Promise.all([
      prisma.user.count(),
      prisma.match.count(),
      prisma.prediction.count(),
      prisma.match.count({ where: { status: 'FINISHED' } })
    ]);
    res.json({ totalUsers, totalMatches, totalPredictions, finishedMatches });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

export default router;