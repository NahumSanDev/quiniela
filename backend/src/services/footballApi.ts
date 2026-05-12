import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { processMatchResults } from './scoring';

const prisma = new PrismaClient();

const API_FOOTBALL_BASE_URL = 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY;

interface FootballApiMatch {
  fixture: {
    id: number;
    date: string;
    status: {
      short: string;
    };
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
    };
    away: {
      id: number;
      name: string;
      logo: string;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

interface ApiResponse {
  response: FootballApiMatch[];
}

function getFlagUrl(teamName: string): string {
  const countryMap: Record<string, string> = {
    'Argentina': 'ar', 'Brazil': 'br', 'France': 'fr', 'Germany': 'de',
    'Spain': 'es', 'England': 'gb', 'Italy': 'it', 'Portugal': 'pt',
    'Netherlands': 'nl', 'Belgium': 'be', 'Uruguay': 'uy', 'Mexico': 'mx',
    'USA': 'us', 'Canada': 'ca', 'Japan': 'jp', 'South Korea': 'kr',
    'Australia': 'au', 'Qatar': 'qa', 'Saudi Arabia': 'sa', 'Morocco': 'ma',
    'Senegal': 'sn', 'Cameroon': 'cm', 'Ghana': 'gh', 'Nigeria': 'ng',
    'Ivory Coast': 'ci', 'Algeria': 'dz', 'Tunisia': 'tn', 'Egypt': 'eg',
    'Poland': 'pl', 'Denmark': 'dk', 'Sweden': 'se', 'Norway': 'no',
    'Switzerland': 'ch', 'Austria': 'at', 'Croatia': 'hr', 'Serbia': 'rs',
    'Ukraine': 'ua', 'Czech Republic': 'cz'
  };

  const code = countryMap[teamName] || teamName.substring(0, 2).toLowerCase();
  return `https://flagcdn.com/w80/${code}.png`;
}

export function mapStatus(apiStatus: string): 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED' {
  const statusMap: Record<string, 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED'> = {
    'NS': 'SCHEDULED',
    '1H': 'LIVE', '2H': 'LIVE', 'HT': 'LIVE', 'ET': 'LIVE', 'P': 'LIVE',
    'FT': 'FINISHED', 'AET': 'FINISHED', 'PEN': 'FINISHED',
    'PST': 'POSTPONED',
    'CANC': 'CANCELLED'
  };
  return statusMap[apiStatus] || 'SCHEDULED';
}

export async function syncMatches(leagueId: number = 1, season: number = 2026): Promise<void> {
  if (!API_KEY) {
    console.warn('API_FOOTBALL_KEY not configured, skipping sync');
    return;
  }

  try {
    const response = await axios.get<ApiResponse>(`${API_FOOTBALL_BASE_URL}/fixtures`, {
      params: { league: leagueId, season },
      headers: { 'x-apisports-key': API_KEY }
    });

    for (const match of response.data.response) {
      const homeFlag = getFlagUrl(match.teams.home.name);
      const awayFlag = getFlagUrl(match.teams.away.name);

      await prisma.match.upsert({
        where: { externalId: String(match.fixture.id) },
        update: {
          homeTeam: match.teams.home.name,
          homeFlag,
          awayTeam: match.teams.away.name,
          awayFlag,
          startTime: new Date(match.fixture.date),
          homeScore: match.goals.home,
          awayScore: match.goals.away,
          status: mapStatus(match.fixture.status.short)
        },
        create: {
          externalId: String(match.fixture.id),
          homeTeam: match.teams.home.name,
          homeFlag,
          awayTeam: match.teams.away.name,
          awayFlag,
          startTime: new Date(match.fixture.date),
          homeScore: match.goals.home,
          awayScore: match.goals.away,
          status: mapStatus(match.fixture.status.short)
        }
      });
    }

    console.log(`Synced ${response.data.response.length} matches`);
  } catch (error) {
    console.error('Error syncing matches:', error);
    throw error;
  }
}

export async function processFinishedMatches(): Promise<void> {
  const finishedMatches = await prisma.match.findMany({
    where: {
      status: 'FINISHED',
      homeScore: { not: null },
      awayScore: { not: null }
    },
    include: {
      predictions: {
        where: { points: 0 }
      }
    }
  });

  for (const match of finishedMatches) {
    try {
      await processMatchResults(match.id);
    } catch (error) {
      console.error(`Error processing match ${match.id}:`, error);
    }
  }
}

export function setupWebhookHandler(router: any): void {
  router.post('/webhooks/football', async (req: Request, res: Response) => {
    try {
      const { match_id, status, goals } = req.body;

      if (status === 'FINISHED') {
        const match = await prisma.match.findFirst({
          where: { externalId: String(match_id) }
        });

        if (match) {
          await prisma.match.update({
            where: { id: match.id },
            data: {
              status: 'FINISHED',
              homeScore: goals?.home,
              awayScore: goals?.away
            }
          });

          await processMatchResults(match.id);
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });
}