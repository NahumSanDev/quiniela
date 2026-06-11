import { PrismaClient, Match, Prediction } from '@prisma/client';

const prisma = new PrismaClient();

interface ScoringResult {
  points: number;
  bonus: boolean;
}

export function calculatePoints(
  prediction: { homeScore: number; awayScore: number },
  match: { homeScore: number | null; awayScore: number | null }
): ScoringResult {
  if (match.homeScore === null || match.awayScore === null) {
    return { points: 0, bonus: false };
  }

  const predictedWinner = getWinner(prediction.homeScore, prediction.awayScore);
  const actualWinner = getWinner(match.homeScore, match.awayScore);

  let points = 0;
  let bonus = false;

  if (predictedWinner === actualWinner) {
    points += 3;
  }

  if (prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore) {
    points += 1;
    bonus = true;
  }

  return { points, bonus };
}

function getWinner(homeScore: number, awayScore: number): 'HOME' | 'AWAY' | 'DRAW' {
  if (homeScore > awayScore) return 'HOME';
  if (awayScore > homeScore) return 'AWAY';
  return 'DRAW';
}

export async function processMatchResults(matchId: number): Promise<void> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });

  if (!match || match.status !== 'FINISHED') {
    throw new Error('Match not finished or not found');
  }

  if (match.homeScore === null || match.awayScore === null) {
    throw new Error('Match scores not available');
  }

  const predictions = await prisma.prediction.findMany({
    where: { matchId },
    include: { user: true }
  });

  for (const prediction of predictions) {
    const { points, bonus } = calculatePoints(
      { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
      { homeScore: match.homeScore, awayScore: match.awayScore }
    );

    const pointsDiff = points - prediction.points;

    await prisma.prediction.update({
      where: { id: prediction.id },
      data: { points, bonus }
    });

    if (pointsDiff !== 0) {
      await prisma.user.update({
        where: { id: prediction.userId },
        data: { points: { increment: pointsDiff } }
      });
    }
  }
}

export interface RankingEntry {
  rank: number;
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  points: number;
}

export async function getRanking(limit: number = 10): Promise<RankingEntry[]> {
  const users = await prisma.user.findMany({
    orderBy: [
      { points: 'desc' },
      { updatedAt: 'asc' }
    ],
    take: limit,
    select: {
      id: true,
      name: true,
      image: true,
      points: true
    }
  });

  return users.map((user, index) => ({
    rank: index + 1,
    userId: user.id,
    name: user.name,
    avatarUrl: user.image,
    points: user.points
  }));
}

export async function getUserPosition(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  if (!user) return -1;

  const position = await prisma.user.count({
    where: {
      OR: [
        { points: { gt: user.points } },
        {
          points: user.points,
          updatedAt: { lt: user.updatedAt }
        }
      ]
    }
  });

  return position + 1;
}