import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PredictionRequest extends Request {
  match?: {
    id: number;
    startTime: Date;
    status: string;
  };
}

export async function validatePredictionTime(
  req: PredictionRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const matchId = parseInt(req.params.matchId || req.body.matchId);

    if (isNaN(matchId)) {
      res.status(400).json({ error: 'Invalid match ID' });
      return;
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, startTime: true, status: true }
    });

    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    if (match.status === 'FINISHED' || match.status === 'LIVE') {
      res.status(403).json({
        error: 'Match has already started or finished',
        code: 'MATCH_LOCKED',
        lockReason: match.status === 'LIVE' ? 'Match in progress' : 'Match finished'
      });
      return;
    }

    const serverTime = new Date();

    if (serverTime >= match.startTime) {
      await prisma.match.update({
        where: { id: matchId },
        data: { status: 'LIVE' }
      });

      res.status(403).json({
        error: 'Prediction window has closed',
        code: 'TIME_EXPIRED',
        serverTime: serverTime.toISOString(),
        matchStartTime: match.startTime.toISOString()
      });
      return;
    }

    req.match = {
      id: match.id,
      startTime: match.startTime,
      status: match.status
    };

    next();
  } catch (error) {
    console.error('Error validating prediction time:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export function validatePredictionData(req: Request, res: Response, next: NextFunction): void {
  const { homeScore, awayScore } = req.body;

  if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
    res.status(400).json({ error: 'Scores must be numbers' });
    return;
  }

  if (homeScore < 0 || homeScore > 20 || awayScore < 0 || awayScore > 20) {
    res.status(400).json({ error: 'Scores must be between 0 and 20' });
    return;
  }

  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
    res.status(400).json({ error: 'Scores must be integers' });
    return;
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }

  next();
}