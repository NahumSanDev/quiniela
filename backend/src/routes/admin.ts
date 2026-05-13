import { Router, Request, Response } from 'express';
import { PrismaClient, MatchStatus } from '@prisma/client';
import axios from 'axios';

const router = Router();
const prisma = new PrismaClient();

export function adminAuth(req: Request, res: Response, next: Function) {
  const adminKey = req.headers['x-admin-key'];
  const validKey = process.env.ADMIN_SECRET || 'admin-secret-key';

  if (adminKey !== validKey) {
    res.status(403).json({ error: 'Acceso denegado' });
    return;
  }
  next();
}

router.get('/matches', adminAuth, async (req: Request, res: Response) => {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { startTime: 'desc' }
    });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/matches', adminAuth, async (req: Request, res: Response) => {
  try {
    const { externalId, homeTeam, homeFlag, awayTeam, awayFlag, startTime, groupStage, venueName, venueCity, venueCountry } = req.body;
    const match = await prisma.match.create({
      data: {
        externalId,
        homeTeam,
        homeFlag,
        awayTeam,
        awayFlag,
        startTime: new Date(startTime),
        groupStage,
        venueName,
        venueCity,
        venueCountry
      }
    });
    res.status(201).json(match);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.put('/matches/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { homeScore, awayScore, status } = req.body;

    const match = await prisma.match.update({
      where: { id: parseInt(id) },
      data: {
        homeScore: homeScore ?? undefined,
        awayScore: awayScore ?? undefined,
        status: status ?? undefined
      }
    });

    if (status === 'FINISHED' && homeScore !== undefined && awayScore !== undefined) {
      const predictions = await prisma.prediction.findMany({
        where: { matchId: parseInt(id), points: 0 }
      });

      for (const prediction of predictions) {
        let points = 0;
        let bonus = false;

        const predictedWinner = prediction.homeScore > prediction.awayScore ? 'HOME' :
                               prediction.awayScore > prediction.homeScore ? 'AWAY' : 'DRAW';
        const actualWinner = homeScore > awayScore ? 'HOME' :
                            awayScore > homeScore ? 'AWAY' : 'DRAW';

        if (predictedWinner === actualWinner) points += 3;
        if (prediction.homeScore === homeScore && prediction.awayScore === awayScore) {
          points += 1;
          bonus = true;
        }

        if (points > 0) {
          await prisma.prediction.update({
            where: { id: prediction.id },
            data: { points, bonus }
          });

          await prisma.user.update({
            where: { id: prediction.userId },
            data: { points: { increment: points } }
          });
        }
      }
    }

    res.json(match);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.delete('/matches/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.match.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.get('/users', adminAuth, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { points: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        points: true,
        createdAt: true,
        _count: { select: { predictions: true } }
      }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.get('/stats', adminAuth, async (req: Request, res: Response) => {
  try {
    const [totalUsers, totalMatches, totalPredictions, finishedMatches] = await Promise.all([
      prisma.user.count(),
      prisma.match.count(),
      prisma.prediction.count(),
      prisma.match.count({ where: { status: 'FINISHED' } })
    ]);
    res.json({ totalUsers, totalMatches, totalPredictions, finishedMatches });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/sync', adminAuth, async (req: Request, res: Response) => {
  if (!process.env.API_FOOTBALL_KEY) {
    res.status(500).json({ error: 'API_FOOTBALL_KEY not configured' });
    return;
  }

  try {
    const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
      params: { league: 1, season: 2026 },
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });

    const countryFlags: Record<string, string> = {
      'Argentina': 'ar', 'Brazil': 'br', 'France': 'fr', 'Germany': 'de',
      'Spain': 'es', 'England': 'gb', 'Italy': 'it', 'Portugal': 'pt',
      'Netherlands': 'nl', 'Belgium': 'be', 'Uruguay': 'uy', 'Mexico': 'mx',
      'USA': 'us', 'Canada': 'ca', 'Japan': 'jp', 'South Korea': 'kr',
      'Australia': 'au', 'Qatar': 'qa', 'Morocco': 'ma'
    };

    let synced = 0;

    for (const match of response.data.response) {
      const homeTeamName = match.teams.home.name;
      const awayTeamName = match.teams.away.name;
      const homeFlag = countryFlags[homeTeamName] || homeTeamName.substring(0, 2).toLowerCase();
      const awayFlag = countryFlags[awayTeamName] || awayTeamName.substring(0, 2).toLowerCase();

      const venue = match.fixture.venue;

      try {
        await prisma.match.upsert({
          where: { externalId: String(match.fixture.id) },
          update: {
            homeTeam: homeTeamName,
            homeFlag,
            awayTeam: awayTeamName,
            awayFlag,
            startTime: new Date(match.fixture.date),
            venueName: venue?.name || null,
            venueCity: venue?.city || null,
            venueCountry: venue?.country || null
          },
          create: {
            externalId: String(match.fixture.id),
            homeTeam: homeTeamName,
            homeFlag,
            awayTeam: awayTeamName,
            awayFlag,
            startTime: new Date(match.fixture.date),
            groupStage: match.league?.name || 'World Cup 2026',
            venueName: venue?.name || null,
            venueCity: venue?.city || null,
            venueCountry: venue?.country || null
          }
        });
        synced++;
      } catch (e) {
        console.error(`Error syncing match ${match.fixture.id}:`, e);
      }
    }

    res.json({ message: `Synced ${synced} matches`, total: response.data.response.length });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

router.post('/sync-live', adminAuth, async (req: Request, res: Response) => {
  if (!process.env.API_FOOTBALL_KEY) {
    res.status(500).json({ error: 'API_FOOTBALL_KEY not configured' });
    return;
  }

  try {
    const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
      params: { live: 'all' },
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });

    let updated = 0;

    for (const match of response.data.response) {
      const status = match.fixture.status.short;
      let dbStatus: MatchStatus = 'SCHEDULED';
      
      if (['FT', 'AET', 'PEN'].includes(status)) dbStatus = 'FINISHED';
      else if (['1H', '2H', 'HT', 'ET', 'P'].includes(status)) dbStatus = 'LIVE';

      try {
        const result = await prisma.match.updateMany({
          where: { externalId: String(match.fixture.id) },
          data: {
            homeScore: match.goals.home,
            awayScore: match.goals.away,
            status: dbStatus
          }
        });
        if (result.count > 0) updated++;
      } catch (e) {
        console.error(`Error updating match ${match.fixture.id}:`, e);
      }
    }

    res.json({ message: `Updated ${updated} matches` });
  } catch (error) {
    res.status(500).json({ error: 'Live sync failed' });
  }
});

export default router;