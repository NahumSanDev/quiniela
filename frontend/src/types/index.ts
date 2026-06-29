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