export interface Match {
  id: number;
  externalId: string;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  startTime: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
  groupStage: string | null;
  isKnockout: boolean;
  halfTimeHomeScore: number | null;
  halfTimeAwayScore: number | null;
  firstGoalTeam: string | null;
  firstGoalMinute: number | null;
  redCard: boolean | null;
  totalCards: number | null;
  extraTime: boolean | null;
  penaltyShootout: boolean | null;
  predictions?: { id: number; homeScore: number; awayScore: number; points: number; bonus: boolean; userId: string }[];
}

export interface Prediction {
  id: number;
  homeScore: number;
  awayScore: number;
  points: number;
  bonus: boolean;
  extraPoints?: number;
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
  updatedAt?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  points: number;
}

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

export interface GroupMatchBetConfig {
  id: string;
  groupId: string;
  matchId: number;
  match: {
    id: number;
    homeTeam: string;
    awayTeam: string;
    groupStage: string | null;
    startTime: string;
    isKnockout: boolean;
  };
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
}

export function defaultKnockoutBetRules(): KnockoutBetRules {
  return {
    totalGoals: 2, bothTeamsScore: 1, cleanSheet: 1, halfTimeScore: 2,
    firstGoalTeam: 1, firstGoalMinute: 2, redCard: 1, totalCards: 2,
    extraTime: 1, penaltyShootout: 1,
  };
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

export interface RankingEntry {
  rank: number;
  userId: number;
  name: string;
  avatarUrl: string | null;
  points: number;
}