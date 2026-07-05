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

    const where: any = {};
    if (req.query.isKnockout === 'true') where.isKnockout = true;
    if (req.query.isKnockout === 'false') where.isKnockout = false;

    const knockoutStages = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Third Place', 'Final'];

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
        include: {
          predictions: {
            select: {
              id: true,
              homeScore: true,
              awayScore: true,
              winner: true,
              isWinnerOnly: true,
              isSimpleScore: true,
              points: true,
              bonus: true,
              extraPoints: true,
              userId: true,
              totalGoals: true,
              bothTeamsScore: true,
              cleanSheet: true,
              halfTimeHomeScore: true,
              halfTimeAwayScore: true,
              firstGoalTeam: true,
              firstGoalMinute: true,
              redCard: true,
              totalCards: true,
              extraTime: true,
              penaltyShootout: true
            }
          }
        }
      }),
      prisma.match.count()
    ]);

    const fixedMatches = matches.map(m => ({
      ...m,
      isKnockout: knockoutStages.includes(m.groupStage || '') || m.isKnockout
    }));

    res.json({
      data: fixedMatches,
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
    const round = req.query.round as string | undefined;
    const ranking = await getRanking(limit, round);
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
    const { homeScore, awayScore, winner, isWinnerOnly, isSimpleScore, groupId: rawGroupId, totalGoals, bothTeamsScore, cleanSheet, halfTimeHomeScore, halfTimeAwayScore, firstGoalTeam, firstGoalMinute, redCard, totalCards, extraTime, penaltyShootout } = req.body;

    let groupId = rawGroupId;

    if (!groupId) {
      let generalGroup = await prisma.group.findUnique({ where: { code: 'GENERAL' } });
      if (!generalGroup) {
        const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
        if (!firstUser) {
          res.status(500).json({ error: 'No users found to create General group' });
          return;
        }
        generalGroup = await prisma.group.create({
          data: {
            name: 'General',
            code: 'GENERAL',
            ownerId: firstUser.id,
            members: { create: { userId: firstUser.id, role: 'ADMIN' } }
          }
        });
      }

      const existingMember = await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId, groupId: generalGroup.id } }
      });
      if (!existingMember) {
        await prisma.groupMember.create({
          data: { userId, groupId: generalGroup.id, role: 'MEMBER' }
        });
      }

      groupId = generalGroup.id;
    }

    const match = await prisma.match.findUnique({ where: { id: parseInt(matchId) }, select: { isKnockout: true } });

    const updateData: any = { homeScore, awayScore, winner, isWinnerOnly: !!isWinnerOnly, isSimpleScore: !!isSimpleScore };
    const createData: any = { userId, matchId: parseInt(matchId), groupId, homeScore, awayScore, winner, isWinnerOnly: !!isWinnerOnly, isSimpleScore: !!isSimpleScore };

    if (match?.isKnockout) {
      if (totalGoals !== undefined) { updateData.totalGoals = totalGoals; createData.totalGoals = totalGoals; }
      if (bothTeamsScore !== undefined) { updateData.bothTeamsScore = bothTeamsScore; createData.bothTeamsScore = bothTeamsScore; }
      if (cleanSheet !== undefined) { updateData.cleanSheet = cleanSheet; createData.cleanSheet = cleanSheet; }
      if (halfTimeHomeScore !== undefined) { updateData.halfTimeHomeScore = halfTimeHomeScore; createData.halfTimeHomeScore = halfTimeHomeScore; }
      if (halfTimeAwayScore !== undefined) { updateData.halfTimeAwayScore = halfTimeAwayScore; createData.halfTimeAwayScore = halfTimeAwayScore; }
      if (firstGoalTeam !== undefined) { updateData.firstGoalTeam = firstGoalTeam; createData.firstGoalTeam = firstGoalTeam; }
      if (firstGoalMinute !== undefined) { updateData.firstGoalMinute = firstGoalMinute; createData.firstGoalMinute = firstGoalMinute; }
      if (redCard !== undefined) { updateData.redCard = redCard; createData.redCard = redCard; }
      if (totalCards !== undefined) { updateData.totalCards = totalCards; createData.totalCards = totalCards; }
      if (extraTime !== undefined) { updateData.extraTime = extraTime; createData.extraTime = extraTime; }
      if (penaltyShootout !== undefined) { updateData.penaltyShootout = penaltyShootout; createData.penaltyShootout = penaltyShootout; }
    }

    const prediction = await prisma.prediction.upsert({
      where: {
        userId_matchId_groupId: {
          userId,
          matchId: parseInt(matchId),
          groupId
        }
      },
      update: updateData,
      create: createData
    });

    res.status(200).json({
      message: 'Prediction saved successfully',
      prediction: {
        id: prediction.id,
        homeScore: prediction.homeScore,
        awayScore: prediction.awayScore,
        winner: prediction.winner,
        isWinnerOnly: prediction.isWinnerOnly,
        isSimpleScore: prediction.isSimpleScore,
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
    const round = req.query.round as string | undefined;
    const ranking = await getRanking(limit, round);
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
    const totalPoints = finishedPredictions.reduce((sum, p) => sum + p.points + (p.extraPoints || 0), 0);

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