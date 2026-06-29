import { PrismaClient, Match, Prediction } from '@prisma/client';

export interface KnockoutBetConfig {
  score: boolean;
  totalGoals: boolean;
  bothTeamsScore: boolean;
  cleanSheet: boolean;
  halfTimeScore: boolean;
  firstGoalTeam: boolean;
  firstGoalMinute: boolean;
  redCard: boolean;
  totalCards: boolean;
  extraTime: boolean;
  penaltyShootout: boolean;
}

export function defaultKnockoutBetConfig(): KnockoutBetConfig {
  return {
    score: true,
    totalGoals: true,
    bothTeamsScore: true,
    cleanSheet: true,
    halfTimeScore: true,
    firstGoalTeam: true,
    firstGoalMinute: true,
    redCard: true,
    totalCards: true,
    extraTime: true,
    penaltyShootout: true,
  };
}

export function disabledKnockoutBetConfig(): KnockoutBetConfig {
  return {
    score: false,
    totalGoals: false, bothTeamsScore: false, cleanSheet: false,
    halfTimeScore: false, firstGoalTeam: false, firstGoalMinute: false,
    redCard: false, totalCards: false, extraTime: false, penaltyShootout: false,
  };
}

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

export interface KnockoutPredictionInput {
  totalGoals?: number | null;
  bothTeamsScore?: boolean | null;
  cleanSheet?: string | null;
  halfTimeHomeScore?: number | null;
  halfTimeAwayScore?: number | null;
  firstGoalTeam?: string | null;
  firstGoalMinute?: number | null;
  redCard?: boolean | null;
  totalCards?: number | null;
  extraTime?: boolean | null;
  penaltyShootout?: boolean | null;
}

export function calculateKnockoutPoints(
  prediction: KnockoutPredictionInput,
  match: {
    homeScore: number | null;
    awayScore: number | null;
    halfTimeHomeScore: number | null;
    halfTimeAwayScore: number | null;
    firstGoalTeam: string | null;
    firstGoalMinute: number | null;
    redCard: boolean | null;
    totalCards: number | null;
    extraTime: boolean | null;
    penaltyShootout: boolean | null;
  },
  enabledBets?: KnockoutBetConfig | null
): number {
  let extra = 0;
  const bets = enabledBets || defaultKnockoutBetConfig();

  if (match.homeScore === null || match.awayScore === null) return 0;

  const actualTotal = match.homeScore + match.awayScore;
  if (bets.totalGoals && prediction.totalGoals !== null && prediction.totalGoals !== undefined) {
    if (prediction.totalGoals === actualTotal) extra += 2;
  }

  const bothScored = match.homeScore > 0 && match.awayScore > 0;
  if (bets.bothTeamsScore && prediction.bothTeamsScore !== null && prediction.bothTeamsScore !== undefined) {
    if (prediction.bothTeamsScore === bothScored) extra += 1;
  }

  if (bets.cleanSheet && prediction.cleanSheet) {
    let actualClean: string;
    if (match.homeScore === 0 && match.awayScore === 0) actualClean = 'both';
    else if (match.homeScore === 0) actualClean = 'home';
    else if (match.awayScore === 0) actualClean = 'away';
    else actualClean = 'none';
    if (prediction.cleanSheet === actualClean) extra += 1;
  }

  if (bets.halfTimeScore &&
    prediction.halfTimeHomeScore !== null && prediction.halfTimeHomeScore !== undefined &&
    prediction.halfTimeAwayScore !== null && prediction.halfTimeAwayScore !== undefined &&
    match.halfTimeHomeScore !== null && match.halfTimeAwayScore !== null
  ) {
    if (prediction.halfTimeHomeScore === match.halfTimeHomeScore &&
        prediction.halfTimeAwayScore === match.halfTimeAwayScore) {
      extra += 2;
    }
  }

  if (bets.firstGoalTeam && prediction.firstGoalTeam && match.firstGoalTeam) {
    if (prediction.firstGoalTeam === match.firstGoalTeam) extra += 1;
  }

  if (bets.firstGoalMinute &&
    prediction.firstGoalMinute !== null && prediction.firstGoalMinute !== undefined &&
    match.firstGoalMinute !== null
  ) {
    if (Math.abs(prediction.firstGoalMinute - match.firstGoalMinute) <= 2) extra += 2;
  }

  if (bets.redCard && prediction.redCard !== null && prediction.redCard !== undefined && match.redCard !== null) {
    if (prediction.redCard === match.redCard) extra += 1;
  }

  if (bets.totalCards && prediction.totalCards !== null && prediction.totalCards !== undefined && match.totalCards !== null) {
    const diff = Math.abs(prediction.totalCards - match.totalCards);
    if (diff <= 1) extra += 2;
  }

  if (bets.extraTime && prediction.extraTime !== null && prediction.extraTime !== undefined && match.extraTime !== null) {
    if (prediction.extraTime === match.extraTime) extra += 1;
  }

  if (bets.penaltyShootout && prediction.penaltyShootout !== null && prediction.penaltyShootout !== undefined && match.penaltyShootout !== null) {
    if (prediction.penaltyShootout === match.penaltyShootout) extra += 1;
  }

  return extra;
}

async function getBetsForPrediction(groupId: string | null, matchId: number): Promise<KnockoutBetConfig> {
  if (!groupId) return defaultKnockoutBetConfig();

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || !group.useExtraBets) return disabledKnockoutBetConfig();

  const config = await prisma.groupMatchBetConfig.findUnique({
    where: { groupId_matchId: { groupId, matchId } }
  });

  if (!config) return defaultKnockoutBetConfig();

  return {
    score: config.score,
    totalGoals: config.totalGoals,
    bothTeamsScore: config.bothTeamsScore,
    cleanSheet: config.cleanSheet,
    halfTimeScore: config.halfTimeScore,
    firstGoalTeam: config.firstGoalTeam,
    firstGoalMinute: config.firstGoalMinute,
    redCard: config.redCard,
    totalCards: config.totalCards,
    extraTime: config.extraTime,
    penaltyShootout: config.penaltyShootout,
  };
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
    const enabledBets = match.isKnockout
      ? await getBetsForPrediction(prediction.groupId, match.id)
      : defaultKnockoutBetConfig();

    const { points, bonus } = enabledBets.score
      ? calculatePoints(
          { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
          { homeScore: match.homeScore, awayScore: match.awayScore }
        )
      : { points: 0, bonus: false };

    let extraPoints = 0;
    if (match.isKnockout) {
      extraPoints = calculateKnockoutPoints(prediction, match, enabledBets);
    }

    const totalNewPoints = points + extraPoints;
    const oldTotal = prediction.points + (prediction as any).extraPoints || 0;
    const pointsDiff = totalNewPoints - oldTotal;

    await prisma.prediction.update({
      where: { id: prediction.id },
      data: { points, bonus, extraPoints }
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

export async function getRanking(limit: number = 10, round?: string): Promise<RankingEntry[]> {
  if (!round || round === 'all') {
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

  const J1_END = new Date('2026-06-18T00:00:00Z');
  const J2_END = new Date('2026-06-24T00:00:00Z');

  let stageFilter: any = {};
  if (round === 'groups-j1') {
    stageFilter = { groupStage: { startsWith: 'Group' }, startTime: { lt: J1_END } };
  } else if (round === 'groups-j2') {
    stageFilter = { groupStage: { startsWith: 'Group' }, startTime: { gte: J1_END, lt: J2_END } };
  } else if (round === 'groups-j3') {
    stageFilter = { groupStage: { startsWith: 'Group' }, startTime: { gte: J2_END } };
  } else if (round === 'knockout') {
    stageFilter = {
      groupStage: { in: ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Third Place', 'Final'] }
    };
  } else if (round === 'Round of 32' || round === 'Round of 16' || round === 'Quarter-final' || round === 'Semi-final') {
    stageFilter = { groupStage: round };
  } else if (round === 'Final') {
    stageFilter = { groupStage: { in: ['Final', 'Third Place'] } };
  }

  const roundMatchIds = (
    await prisma.match.findMany({ where: stageFilter, select: { id: true } })
  ).map(m => m.id);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      image: true,
      predictions: {
        where: { matchId: { in: roundMatchIds } },
        select: { points: true }
      }
    }
  });

  return users
    .map(user => ({
      userId: user.id,
      name: user.name,
      avatarUrl: user.image,
      points: user.predictions.reduce((sum, p) => sum + p.points, 0)
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
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