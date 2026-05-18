import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { validatePredictionTime, validatePredictionData, requireAuth, PredictionRequest } from '../middleware/prediction';
import { calculatePoints, processMatchResults, getRanking, getUserPosition } from '../services/scoring';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
        include: {
          predictions: {
            select: {
              id: true,
              homeScore: true,
              awayScore: true,
              points: true,
              bonus: true,
              userId: true
            }
          }
        }
      }),
      prisma.match.count()
    ]);

    res.json({
      data: matches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
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

router.post('/:matchId/prediction', validatePredictionTime, validatePredictionData, async (req: PredictionRequest, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization required' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const userId = decoded.userId;
    
    const { matchId } = req.params;
    const { homeScore, awayScore, groupId } = req.body;

    if (!groupId) {
      res.status(400).json({ error: 'Group ID is required' });
      return;
    }

    const prediction = await prisma.prediction.upsert({
      where: {
        userId_matchId_groupId: {
          userId,
          matchId: parseInt(matchId),
          groupId
        }
      },
      update: {
        homeScore,
        awayScore
      },
      create: {
        userId,
        matchId: parseInt(matchId),
        groupId,
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

router.delete('/:matchId/prediction', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization required' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const userId = decoded.userId;

    const { matchId } = req.params;
    const { groupId } = req.body;

    const match = await prisma.match.findUnique({
      where: { id: parseInt(matchId) },
      select: { status: true, startTime: true }
    });

    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    if (match.status === 'LIVE' || match.status === 'FINISHED' || new Date() >= match.startTime) {
      res.status(403).json({ error: 'Cannot delete prediction after match has started' });
      return;
    }

    await prisma.prediction.deleteMany({
      where: {
        userId,
        matchId: parseInt(matchId),
        ...(groupId && { groupId })
      }
    });

    res.json({ message: 'Prediction deleted successfully' });
  } catch (error) {
    console.error('Error deleting prediction:', error);
    res.status(500).json({ error: 'Failed to delete prediction' });
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

router.get('/user/:userId/stats', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const predictions = await prisma.prediction.findMany({
      where: { userId },
      include: {
        match: {
          select: { homeScore: true, awayScore: true, status: true }
        }
      }
    });

    const totalPredictions = predictions.length;
    const finishedPredictions = predictions.filter(p => p.match.status === 'FINISHED');
    const correctPredictions = finishedPredictions.filter(p => p.points > 0);
    const exactScores = finishedPredictions.filter(p => p.bonus);
    const totalPoints = finishedPredictions.reduce((sum, p) => sum + p.points, 0);

    const accuracy = finishedPredictions.length > 0
      ? Math.round((correctPredictions.length / finishedPredictions.length) * 100)
      : 0;

    res.json({
      totalPredictions,
      finishedMatches: finishedPredictions.length,
      pendingMatches: totalPredictions - finishedPredictions.length,
      correctPredictions: correctPredictions.length,
      exactScores: exactScores.length,
      totalPoints,
      accuracy
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;