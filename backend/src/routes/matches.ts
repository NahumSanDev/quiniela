import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { validatePredictionTime, validatePredictionData, requireAuth, PredictionRequest } from '../middleware/prediction';
import { calculatePoints, processMatchResults, getRanking, getUserPosition } from '../services/scoring';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { startTime: 'asc' },
      include: {
        predictions: {
          select: {
            id: true,
            homeScore: true,
            awayScore: true,
            points: true,
            bonus: true
          }
        }
      }
    });

    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        predictions: {
          include: {
            user: {
              select: { id: true, name: true, image: true }
            }
          }
        }
      }
    });

    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    res.json(match);
  } catch (error) {
    console.error('Error fetching match:', error);
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

router.post('/:matchId/prediction', requireAuth, validatePredictionTime, validatePredictionData, async (req: PredictionRequest, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { matchId } = req.params;
    const { homeScore, awayScore } = req.body;

    const prediction = await prisma.prediction.upsert({
      where: {
        userId_matchId: {
          userId,
          matchId: parseInt(matchId)
        }
      },
      update: {
        homeScore,
        awayScore
      },
      create: {
        userId,
        matchId: parseInt(matchId),
        homeScore,
        awayScore
      }
    });

    res.status(200).json({
      message: 'Prediction saved successfully',
      prediction: {
        id: prediction.id,
        homeScore: prediction.homeScore,
        awayScore: prediction.awayScore,
        updatedAt: prediction.updatedAt
      }
    });
  } catch (error) {
    console.error('Error saving prediction:', error);
    res.status(500).json({ error: 'Failed to save prediction' });
  }
});

router.get('/user/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;

    const predictions = await prisma.prediction.findMany({
      where: { userId },
      include: { match: true },
      orderBy: { match: { startTime: 'asc' } }
    });

    const position = await getUserPosition(userId);

    res.json({
      predictions,
      position
    });
  } catch (error) {
    console.error('Error fetching user predictions:', error);
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

router.post('/:matchId/calculate', async (req: Request, res: Response) => {
  try {
    const matchId = parseInt(req.params.matchId);
    await processMatchResults(matchId);

    res.json({ message: 'Points calculated successfully' });
  } catch (error) {
    console.error('Error calculating points:', error);
    res.status(500).json({ error: 'Failed to calculate points' });
  }
});

router.get('/ranking', async (req: Request, res: Response) => {
  try {
    console.log('Ranking endpoint called');
    const limit = parseInt(req.query.limit as string) || 10;
    const ranking = await getRanking(limit);
    console.log('Ranking fetched:', ranking.length, 'users');

    res.json(ranking);
  } catch (error) {
    console.error('Error fetching ranking:', error);
    res.status(500).json({ error: 'Failed to fetch ranking' });
  }
});

export default router;