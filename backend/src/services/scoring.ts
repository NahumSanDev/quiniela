import { PrismaClient, Match, Prediction } from '@prisma/client';

export interface KnockoutBetConfig {
  score: boolean;
  simpleScore: boolean;
  winnerOnly: boolean;
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
    simpleScore: false,
    winnerOnly: true,
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
    score: true, simpleScore: false, winnerOnly: false,
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
  prediction: { homeScore: number; awayScore: number; winner?: string | null; isWinnerOnly?: boolean | null; isSimpleScore?: boolean | null },
  match: { homeScore: number | null; awayScore: number | null; homeTeam?: string | null; awayTeam?: string | null; regularTimeHomeScore?: number | null; regularTimeAwayScore?: number | null },
  config?: { score?: boolean | null; simpleScore?: boolean | null; winnerPoints?: number | null }
): ScoringResult {
  if (match.homeScore === null || match.awayScore === null) {
    return { points: 0, bonus: false };
  }

  let points = 0;
  let bonus = false;

  // Completo scoring (3+1): applies when not simpleScore/winnerOnly mode, or when both score+simpleScore enabled
  if (!prediction.isWinnerOnly && (!prediction.isSimpleScore || config?.score)) {
    const predictedWinner = getWinner(prediction.homeScore, prediction.awayScore);
    const actualWinner = getWinner(match.homeScore, match.awayScore);

    if (predictedWinner === actualWinner) {
      points += 3;
    }

    if (prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore) {
      points += 1;
      bonus = true;
    }
  }

  // SimpleScore scoring (+1): applies when isSimpleScore is set
  if (prediction.isSimpleScore) {
    const targetHome = match.regularTimeHomeScore ?? match.homeScore;
    const targetAway = match.regularTimeAwayScore ?? match.awayScore;
    if (targetHome !== null && targetAway !== null && prediction.homeScore === targetHome && prediction.awayScore === targetAway) {
      points += 1;
    }
  }

  // Winner scoring: always independent
  if (prediction.isWinnerOnly && prediction.winner) {
    const actualWinner = match.homeTeam && match.awayTeam
      ? (match.homeScore > match.awayScore ? match.homeTeam :
         match.awayScore > match.homeScore ? match.awayTeam : null)
      : null;
    if (prediction.winner === actualWinner) {
      points += config?.winnerPoints ?? 3;
    }
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

export interface KnockoutBetRules {
  totalGoals: number;
  bothTeamsScore: number;
  cleanSheet: number;
  halfTimeScore: number;
  firstGoalTeam: number;
  firstGoalMinute: number;
  redCard: number;
  totalCards: number;
  extraTime: number;
  penaltyShootout: number;
  winnerPoints?: number;
}

export function defaultKnockoutBetRules(): KnockoutBetRules {
  return {
    totalGoals: 2, bothTeamsScore: 1, cleanSheet: 1, halfTimeScore: 2,
    firstGoalTeam: 1, firstGoalMinute: 2, redCard: 1, totalCards: 2,
    extraTime: 1, penaltyShootout: 1, winnerPoints: 3,
  };
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
  enabledBets?: KnockoutBetConfig | null,
  rules?: KnockoutBetRules | null
): number {
  let extra = 0;
  const bets = enabledBets || defaultKnockoutBetConfig();
  const pts = rules || defaultKnockoutBetRules();

  if (match.homeScore === null || match.awayScore === null) return 0;

  const actualTotal = match.homeScore + match.awayScore;
  if (bets.totalGoals && prediction.totalGoals !== null && prediction.totalGoals !== undefined) {
    if (prediction.totalGoals === actualTotal) extra += pts.totalGoals;
  }

  const bothScored = match.homeScore > 0 && match.awayScore > 0;
  if (bets.bothTeamsScore && prediction.bothTeamsScore !== null && prediction.bothTeamsScore !== undefined) {
    if (prediction.bothTeamsScore === bothScored) extra += pts.bothTeamsScore;
  }

  if (bets.cleanSheet && prediction.cleanSheet) {
    let actualClean: string;
    if (match.homeScore === 0 && match.awayScore === 0) actualClean = 'both';
    else if (match.homeScore === 0) actualClean = 'home';
    else if (match.awayScore === 0) actualClean = 'away';
    else actualClean = 'none';
    if (prediction.cleanSheet === actualClean) extra += pts.cleanSheet;
  }

  if (bets.halfTimeScore &&
    prediction.halfTimeHomeScore !== null && prediction.halfTimeHomeScore !== undefined &&
    prediction.halfTimeAwayScore !== null && prediction.halfTimeAwayScore !== undefined &&
    match.halfTimeHomeScore !== null && match.halfTimeAwayScore !== null
  ) {
    if (prediction.halfTimeHomeScore === match.halfTimeHomeScore &&
        prediction.halfTimeAwayScore === match.halfTimeAwayScore) {
      extra += pts.halfTimeScore;
    }
  }

  if (bets.firstGoalTeam && prediction.firstGoalTeam && match.firstGoalTeam) {
    if (prediction.firstGoalTeam === match.firstGoalTeam) extra += pts.firstGoalTeam;
  }

  if (bets.firstGoalMinute &&
    prediction.firstGoalMinute !== null && prediction.firstGoalMinute !== undefined &&
    match.firstGoalMinute !== null
  ) {
    if (Math.abs(prediction.firstGoalMinute - match.firstGoalMinute) <= 2) extra += pts.firstGoalMinute;
  }

  if (bets.redCard && prediction.redCard !== null && prediction.redCard !== undefined && match.redCard !== null) {
    if (prediction.redCard === match.redCard) extra += pts.redCard;
  }

  if (bets.totalCards && prediction.totalCards !== null && prediction.totalCards !== undefined && match.totalCards !== null) {
    const diff = Math.abs(prediction.totalCards - match.totalCards);
    if (diff <= 1) extra += pts.totalCards;
  }

  if (bets.extraTime && prediction.extraTime !== null && prediction.extraTime !== undefined) {
    const actualExtraTime = match.extraTime ?? false;
    if (prediction.extraTime === actualExtraTime) extra += pts.extraTime;
  }

  if (bets.penaltyShootout && prediction.penaltyShootout !== null && prediction.penaltyShootout !== undefined) {
    const actualPenaltyShootout = match.penaltyShootout ?? false;
    if (prediction.penaltyShootout === actualPenaltyShootout) extra += pts.penaltyShootout;
  }

  return extra;
}

export async function getGroupBetConfig(groupId: string | null): Promise<{
  bets: KnockoutBetConfig;
  rules: KnockoutBetRules | null;
}> {
  if (!groupId) return { bets: defaultKnockoutBetConfig(), rules: null };

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || !group.useExtraBets) return { bets: disabledKnockoutBetConfig(), rules: null };

  if (group.betRules) {
    const bc = group.betRules as any;
    return {
      bets: {
        score: bc.score ?? true,
        simpleScore: bc.simpleScore ?? false,
        winnerOnly: bc.winnerOnly ?? false,
        totalGoals: bc.totalGoals ?? false,
        bothTeamsScore: bc.bothTeamsScore ?? false,
        cleanSheet: bc.cleanSheet ?? false,
        halfTimeScore: bc.halfTimeScore ?? false,
        firstGoalTeam: bc.firstGoalTeam ?? false,
        firstGoalMinute: bc.firstGoalMinute ?? false,
        redCard: bc.redCard ?? false,
        totalCards: bc.totalCards ?? false,
        extraTime: bc.extraTime ?? false,
        penaltyShootout: bc.penaltyShootout ?? false,
      },
      rules: (bc.rules as KnockoutBetRules) ?? null,
    };
  }

  return { bets: defaultKnockoutBetConfig(), rules: null };
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
    const { bets: enabledBets, rules } = match.isKnockout
      ? await getGroupBetConfig(prediction.groupId)
      : { bets: defaultKnockoutBetConfig(), rules: null as KnockoutBetRules | null };

      const { points, bonus } = enabledBets.score || enabledBets.simpleScore || enabledBets.winnerOnly
        ? calculatePoints(
            { homeScore: prediction.homeScore, awayScore: prediction.awayScore, winner: prediction.winner, isWinnerOnly: prediction.isWinnerOnly, isSimpleScore: prediction.isSimpleScore },
            { homeScore: match.homeScore, awayScore: match.awayScore, homeTeam: match.homeTeam, awayTeam: match.awayTeam, regularTimeHomeScore: match.regularTimeHomeScore, regularTimeAwayScore: match.regularTimeAwayScore },
            { score: enabledBets.score, simpleScore: enabledBets.simpleScore, winnerPoints: rules?.winnerPoints ?? null }
          )
        : { points: 0, bonus: false };

    let extraPoints = 0;
    if (match.isKnockout) {
      extraPoints = calculateKnockoutPoints(prediction, match, enabledBets, rules);
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
        select: { points: true, extraPoints: true }
      }
    }
  });

  return users
    .map(user => ({
      userId: user.id,
      name: user.name,
      avatarUrl: user.image,
        points: user.predictions.reduce((sum, p) => sum + p.points + (p.extraPoints || 0), 0)
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