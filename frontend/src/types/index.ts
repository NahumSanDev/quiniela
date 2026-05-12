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
}

export interface Prediction {
  id: number;
  homeScore: number;
  awayScore: number;
  points: number;
  bonus: boolean;
  updatedAt: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  points: number;
}

export interface RankingEntry {
  rank: number;
  userId: number;
  name: string;
  avatarUrl: string | null;
  points: number;
}