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

router.get('/test-api', async (req: Request, res: Response) => {
  if (!process.env.API_FOOTBALL_KEY) {
    res.status(500).json({ error: 'API_FOOTBALL_KEY not configured' });
    return;
  }

  const { league, season } = req.query;
  
  try {
    console.log(`Testing API with league: ${league}, season: ${season}`);
    const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
      params: { league: league || 1, season: season || 2026 },
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });
    
    res.json({ 
      status: response.status,
      results: response.data.results,
      matchesCount: response.data.response?.length || 0,
      firstMatch: response.data.response?.[0] || null,
      errors: response.data.errors
    });
  } catch (error: any) {
    console.error('API Test error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

router.post('/sync', adminAuth, async (req: Request, res: Response) => {
  if (!process.env.API_FOOTBALL_KEY) {
    res.status(500).json({ error: 'API_FOOTBALL_KEY not configured' });
    return;
  }

  try {
    console.log('Attempting sync with league: 1, season: 2026');
    const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
      params: { league: 1, season: 2026 },
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });
    
    console.log('API Response status:', response.status);
    console.log('Results count:', response.data.results);
    console.log('Matches count:', response.data.response?.length || 0);
    
    if (!response.data.response || response.data.response.length === 0) {
      console.log('No matches found in API response');
      res.json({ message: 'No matches found', total: 0, synced: 0 });
      return;
    }

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

    console.log('Response matches count:', response.data.response?.length || 0);
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

router.post('/seed-worldcup', adminAuth, async (req: Request, res: Response) => {
  const worldCupMatches = [
    { homeTeam: 'Argentina', homeFlag: 'ar', awayTeam: 'Brazil', awayFlag: 'br', startTime: new Date('2026-06-11T21:00:00Z'), groupStage: 'Group A', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
    { homeTeam: 'Mexico', homeFlag: 'mx', awayTeam: 'USA', awayFlag: 'us', startTime: new Date('2026-06-12T01:00:00Z'), groupStage: 'Group A', venueName: 'SoFi Stadium', venueCity: 'Los Angeles', venueCountry: 'USA' },
    { homeTeam: 'Canada', homeFlag: 'ca', awayTeam: 'Uruguay', awayFlag: 'uy', startTime: new Date('2026-06-12T21:00:00Z'), groupStage: 'Group B', venueName: 'BMO Field', venueCity: 'Toronto', venueCountry: 'Canada' },
    { homeTeam: 'Spain', homeFlag: 'es', awayTeam: 'Germany', awayFlag: 'de', startTime: new Date('2026-06-13T01:00:00Z'), groupStage: 'Group C', venueName: 'NRG Stadium', venueCity: 'Houston', venueCountry: 'USA' },
    { homeTeam: 'France', homeFlag: 'fr', awayTeam: 'England', awayFlag: 'gb', startTime: new Date('2026-06-13T21:00:00Z'), groupStage: 'Group D', venueName: 'AT&T Stadium', venueCity: 'Dallas', venueCountry: 'USA' },
    { homeTeam: 'Portugal', homeFlag: 'pt', awayTeam: 'Netherlands', awayFlag: 'nl', startTime: new Date('2026-06-14T01:00:00Z'), groupStage: 'Group E', venueName: 'Lumen Field', venueCity: 'Seattle', venueCountry: 'USA' },
    { homeTeam: 'Italy', homeFlag: 'it', awayTeam: 'Belgium', awayFlag: 'be', startTime: new Date('2026-06-14T21:00:00Z'), groupStage: 'Group F', venueName: 'Arrowhead Stadium', venueCity: 'Kansas City', venueCountry: 'USA' },
    { homeTeam: 'Japan', homeFlag: 'jp', awayTeam: 'South Korea', awayFlag: 'kr', startTime: new Date('2026-06-15T01:00:00Z'), groupStage: 'Group G', venueName: 'Mercedes-Benz Stadium', venueCity: 'Atlanta', venueCountry: 'USA' },
    { homeTeam: 'Australia', homeFlag: 'au', awayTeam: 'Qatar', awayFlag: 'qa', startTime: new Date('2026-06-15T21:00:00Z'), groupStage: 'Group H', venueName: 'Lincoln Financial Field', venueCity: 'Philadelphia', venueCountry: 'USA' },
    { homeTeam: 'Morocco', homeFlag: 'ma', awayTeam: 'Argentina', awayFlag: 'ar', startTime: new Date('2026-06-17T21:00:00Z'), groupStage: 'Group A', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
    { homeTeam: 'USA', homeFlag: 'us', awayTeam: 'Canada', awayFlag: 'ca', startTime: new Date('2026-06-18T01:00:00Z'), groupStage: 'Group A', venueName: 'SoFi Stadium', venueCity: 'Los Angeles', venueCountry: 'USA' },
    { homeTeam: 'Brazil', homeFlag: 'br', awayTeam: 'Mexico', awayFlag: 'mx', startTime: new Date('2026-06-18T21:00:00Z'), groupStage: 'Group B', venueName: 'BMO Field', venueCity: 'Toronto', venueCountry: 'Canada' },
    { homeTeam: 'Germany', homeFlag: 'de', awayTeam: 'France', awayFlag: 'fr', startTime: new Date('2026-06-19T01:00:00Z'), groupStage: 'Group C', venueName: 'NRG Stadium', venueCity: 'Houston', venueCountry: 'USA' },
    { homeTeam: 'England', homeFlag: 'gb', awayTeam: 'Spain', awayFlag: 'es', startTime: new Date('2026-06-19T21:00:00Z'), groupStage: 'Group D', venueName: 'AT&T Stadium', venueCity: 'Dallas', venueCountry: 'USA' },
    { homeTeam: 'Netherlands', homeFlag: 'nl', awayTeam: 'Portugal', awayFlag: 'pt', startTime: new Date('2026-06-20T01:00:00Z'), groupStage: 'Group E', venueName: 'Lumen Field', venueCity: 'Seattle', venueCountry: 'USA' },
    { homeTeam: 'Belgium', homeFlag: 'be', awayTeam: 'Italy', awayFlag: 'it', startTime: new Date('2026-06-20T21:00:00Z'), groupStage: 'Group F', venueName: 'Arrowhead Stadium', venueCity: 'Kansas City', venueCountry: 'USA' },
    { homeTeam: 'South Korea', homeFlag: 'kr', awayTeam: 'Japan', awayFlag: 'jp', startTime: new Date('2026-06-21T01:00:00Z'), groupStage: 'Group G', venueName: 'Mercedes-Benz Stadium', venueCity: 'Atlanta', venueCountry: 'USA' },
    { homeTeam: 'Qatar', homeFlag: 'qa', awayTeam: 'Australia', awayFlag: 'au', startTime: new Date('2026-06-21T21:00:00Z'), groupStage: 'Group H', venueName: 'Lincoln Financial Field', venueCity: 'Philadelphia', venueCountry: 'USA' },
    { homeTeam: 'Uruguay', homeFlag: 'uy', awayTeam: 'Canada', awayFlag: 'ca', startTime: new Date('2026-06-22T21:00:00Z'), groupStage: 'Group B', venueName: 'BMO Field', venueCity: 'Toronto', venueCountry: 'Canada' },
    { homeTeam: 'Argentina', homeFlag: 'ar', awayTeam: 'Canada', awayFlag: 'ca', startTime: new Date('2026-06-23T01:00:00Z'), groupStage: 'Group A', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
    { homeTeam: 'Mexico', homeFlag: 'mx', awayTeam: 'Uruguay', awayFlag: 'uy', startTime: new Date('2026-06-23T21:00:00Z'), groupStage: 'Group A', venueName: 'SoFi Stadium', venueCity: 'Los Angeles', venueCountry: 'USA' },
    { homeTeam: 'USA', homeFlag: 'us', awayTeam: 'Brazil', awayFlag: 'br', startTime: new Date('2026-06-24T01:00:00Z'), groupStage: 'Group A', venueName: 'NRG Stadium', venueCity: 'Houston', venueCountry: 'USA' },
    { homeTeam: 'France', homeFlag: 'fr', awayTeam: 'Spain', awayFlag: 'es', startTime: new Date('2026-06-24T21:00:00Z'), groupStage: 'Group C', venueName: 'AT&T Stadium', venueCity: 'Dallas', venueCountry: 'USA' },
    { homeTeam: 'Germany', homeFlag: 'de', awayTeam: 'England', awayFlag: 'gb', startTime: new Date('2026-06-25T01:00:00Z'), groupStage: 'Group C', venueName: 'Lumen Field', venueCity: 'Seattle', venueCountry: 'USA' },
    { homeTeam: 'Portugal', homeFlag: 'pt', awayTeam: 'Italy', awayFlag: 'it', startTime: new Date('2026-06-25T21:00:00Z'), groupStage: 'Group E', venueName: 'Arrowhead Stadium', venueCity: 'Kansas City', venueCountry: 'USA' },
    { homeTeam: 'Netherlands', homeFlag: 'nl', awayTeam: 'Belgium', awayFlag: 'be', startTime: new Date('2026-06-26T01:00:00Z'), groupStage: 'Group E', venueName: 'Mercedes-Benz Stadium', venueCity: 'Atlanta', venueCountry: 'USA' },
    { homeTeam: 'Japan', homeFlag: 'jp', awayTeam: 'Australia', awayFlag: 'au', startTime: new Date('2026-06-26T21:00:00Z'), groupStage: 'Group G', venueName: 'SoFi Stadium', venueCity: 'Los Angeles', venueCountry: 'USA' },
    { homeTeam: 'South Korea', homeFlag: 'kr', awayTeam: 'Qatar', awayFlag: 'qa', startTime: new Date('2026-06-27T01:00:00Z'), groupStage: 'Group G', venueName: 'BMO Field', venueCity: 'Toronto', venueCountry: 'Canada' },
    { homeTeam: 'Morocco', homeFlag: 'ma', awayTeam: 'Mexico', awayFlag: 'mx', startTime: new Date('2026-06-27T21:00:00Z'), groupStage: 'Group A', venueName: 'NRG Stadium', venueCity: 'Houston', venueCountry: 'USA' },
    { homeTeam: 'Argentina', homeFlag: 'ar', awayTeam: 'USA', awayFlag: 'us', startTime: new Date('2026-06-28T01:00:00Z'), groupStage: 'Group A', venueName: 'AT&T Stadium', venueCity: 'Dallas', venueCountry: 'USA' },
    { homeTeam: 'Brazil', homeFlag: 'br', awayTeam: 'Canada', awayFlag: 'ca', startTime: new Date('2026-06-28T21:00:00Z'), groupStage: 'Group A', venueName: 'Lumen Field', venueCity: 'Seattle', venueCountry: 'USA' },
    { homeTeam: 'Uruguay', homeFlag: 'uy', awayTeam: 'Mexico', awayFlag: 'mx', startTime: new Date('2026-06-29T01:00:00Z'), groupStage: 'Group A', venueName: 'Arrowhead Stadium', venueCity: 'Kansas City', venueCountry: 'USA' },
    { homeTeam: 'England', homeFlag: 'gb', awayTeam: 'Germany', awayFlag: 'de', startTime: new Date('2026-06-29T21:00:00Z'), groupStage: 'Group C', venueName: 'Mercedes-Benz Stadium', venueCity: 'Atlanta', venueCountry: 'USA' },
    { homeTeam: 'Spain', homeFlag: 'es', awayTeam: 'France', awayFlag: 'fr', startTime: new Date('2026-06-30T01:00:00Z'), groupStage: 'Group C', venueName: 'Lincoln Financial Field', venueCity: 'Philadelphia', venueCountry: 'USA' },
    { homeTeam: 'Italy', homeFlag: 'it', awayTeam: 'Portugal', awayFlag: 'pt', startTime: new Date('2026-06-30T21:00:00Z'), groupStage: 'Group E', venueName: 'SoFi Stadium', venueCity: 'Los Angeles', venueCountry: 'USA' },
    { homeTeam: 'Belgium', homeFlag: 'be', awayTeam: 'Netherlands', awayFlag: 'nl', startTime: new Date('2026-07-01T01:00:00Z'), groupStage: 'Group E', venueName: 'BMO Field', venueCity: 'Toronto', venueCountry: 'Canada' },
    { homeTeam: 'Australia', homeFlag: 'au', awayTeam: 'Japan', awayFlag: 'jp', startTime: new Date('2026-07-01T21:00:00Z'), groupStage: 'Group G', venueName: 'NRG Stadium', venueCity: 'Houston', venueCountry: 'USA' },
    { homeTeam: 'Qatar', homeFlag: 'qa', awayTeam: 'South Korea', awayFlag: 'kr', startTime: new Date('2026-07-02T01:00:00Z'), groupStage: 'Group G', venueName: 'AT&T Stadium', venueCity: 'Dallas', venueCountry: 'USA' },
    { homeTeam: 'Morocco', homeFlag: 'ma', awayTeam: 'Uruguay', awayFlag: 'uy', startTime: new Date('2026-07-02T21:00:00Z'), groupStage: 'Group A', venueName: 'Lumen Field', venueCity: 'Seattle', venueCountry: 'USA' },
    { homeTeam: 'Canada', homeFlag: 'ca', awayTeam: 'Mexico', awayFlag: 'mx', startTime: new Date('2026-07-03T01:00:00Z'), groupStage: 'Group A', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
    { homeTeam: 'Brazil', homeFlag: 'br', awayTeam: 'Argentina', awayFlag: 'ar', startTime: new Date('2026-07-03T21:00:00Z'), groupStage: 'Group A', venueName: 'Arrowhead Stadium', venueCity: 'Kansas City', venueCountry: 'USA' },
    { homeTeam: 'USA', homeFlag: 'us', awayTeam: 'Morocco', awayFlag: 'ma', startTime: new Date('2026-07-04T01:00:00Z'), groupStage: 'Group A', venueName: 'Mercedes-Benz Stadium', venueCity: 'Atlanta', venueCountry: 'USA' },
    { homeTeam: 'Portugal', homeFlag: 'pt', awayTeam: 'Belgium', awayFlag: 'be', startTime: new Date('2026-07-04T21:00:00Z'), groupStage: 'Group E', venueName: 'Lincoln Financial Field', venueCity: 'Philadelphia', venueCountry: 'USA' },
    { homeTeam: 'Netherlands', homeFlag: 'nl', awayTeam: 'Italy', awayFlag: 'it', startTime: new Date('2026-07-05T01:00:00Z'), groupStage: 'Group E', venueName: 'SoFi Stadium', venueCity: 'Los Angeles', venueCountry: 'USA' },
    { homeTeam: 'Germany', homeFlag: 'de', awayTeam: 'France', awayFlag: 'fr', startTime: new Date('2026-07-05T21:00:00Z'), groupStage: 'Group C', venueName: 'BMO Field', venueCity: 'Toronto', venueCountry: 'Canada' },
    { homeTeam: 'England', homeFlag: 'gb', awayTeam: 'Spain', awayFlag: 'es', startTime: new Date('2026-07-06T01:00:00Z'), groupStage: 'Group C', venueName: 'NRG Stadium', venueCity: 'Houston', venueCountry: 'USA' },
    { homeTeam: 'Japan', homeFlag: 'jp', awayTeam: 'Qatar', awayFlag: 'qa', startTime: new Date('2026-07-06T21:00:00Z'), groupStage: 'Group G', venueName: 'AT&T Stadium', venueCity: 'Dallas', venueCountry: 'USA' },
    { homeTeam: 'South Korea', homeFlag: 'kr', awayTeam: 'Australia', awayFlag: 'au', startTime: new Date('2026-07-07T01:00:00Z'), groupStage: 'Group G', venueName: 'Lumen Field', venueCity: 'Seattle', venueCountry: 'USA' },
    { homeTeam: '1A', homeFlag: 'br', awayTeam: '3C', awayFlag: 'es', startTime: new Date('2026-07-05T21:00:00Z'), groupStage: 'Round of 16', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
    { homeTeam: '1C', homeFlag: 'fr', awayTeam: '3D', awayFlag: 'gb', startTime: new Date('2026-07-05T01:00:00Z'), groupStage: 'Round of 16', venueName: 'SoFi Stadium', venueCity: 'Los Angeles', venueCountry: 'USA' },
    { homeTeam: '1E', homeFlag: 'pt', awayTeam: '3A', awayFlag: 'ar', startTime: new Date('2026-07-06T21:00:00Z'), groupStage: 'Round of 16', venueName: 'AT&T Stadium', venueCity: 'Dallas', venueCountry: 'USA' },
    { homeTeam: '1G', homeFlag: 'jp', awayTeam: '2H', awayFlag: 'ma', startTime: new Date('2026-07-06T01:00:00Z'), groupStage: 'Round of 16', venueName: 'Mercedes-Benz Stadium', venueCity: 'Atlanta', venueCountry: 'USA' },
    { homeTeam: '1B', homeFlag: 'de', awayTeam: '3F', awayFlag: 'it', startTime: new Date('2026-07-07T21:00:00Z'), groupStage: 'Round of 16', venueName: 'Lumen Field', venueCity: 'Seattle', venueCountry: 'USA' },
    { homeTeam: '1D', homeFlag: 'nl', awayTeam: '2E', awayFlag: 'be', startTime: new Date('2026-07-07T01:00:00Z'), groupStage: 'Round of 16', venueName: 'Arrowhead Stadium', venueCity: 'Kansas City', venueCountry: 'USA' },
    { homeTeam: '1F', homeFlag: 'kr', awayTeam: '2A', awayFlag: 'uy', startTime: new Date('2026-07-08T21:00:00Z'), groupStage: 'Round of 16', venueName: 'NRG Stadium', venueCity: 'Houston', venueCountry: 'USA' },
    { homeTeam: '1H', homeFlag: 'au', awayTeam: '2B', awayFlag: 'mx', startTime: new Date('2026-07-08T01:00:00Z'), groupStage: 'Round of 16', venueName: 'Lincoln Financial Field', venueCity: 'Philadelphia', venueCountry: 'USA' },
    { homeTeam: 'W49', homeFlag: 'br', awayTeam: 'W50', awayFlag: 'fr', startTime: new Date('2026-07-10T21:00:00Z'), groupStage: 'Quarter-final', venueName: 'Mercedes-Benz Stadium', venueCity: 'Atlanta', venueCountry: 'USA' },
    { homeTeam: 'W53', homeFlag: 'pt', awayTeam: 'W54', awayFlag: 'jp', startTime: new Date('2026-07-10T01:00:00Z'), groupStage: 'Quarter-final', venueName: 'SoFi Stadium', venueCity: 'Los Angeles', venueCountry: 'USA' },
    { homeTeam: 'W51', homeFlag: 'de', awayTeam: 'W52', awayFlag: 'nl', startTime: new Date('2026-07-11T21:00:00Z'), groupStage: 'Quarter-final', venueName: 'AT&T Stadium', venueCity: 'Dallas', venueCountry: 'USA' },
    { homeTeam: 'W55', homeFlag: 'kr', awayTeam: 'W56', awayFlag: 'au', startTime: new Date('2026-07-11T01:00:00Z'), groupStage: 'Quarter-final', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
    { homeTeam: 'W57', homeFlag: 'br', awayTeam: 'W58', awayFlag: 'pt', startTime: new Date('2026-07-14T21:00:00Z'), groupStage: 'Semi-final', venueName: 'SoFi Stadium', venueCity: 'Los Angeles', venueCountry: 'USA' },
    { homeTeam: 'W59', homeFlag: 'de', awayTeam: 'W60', awayFlag: 'kr', startTime: new Date('2026-07-15T01:00:00Z'), groupStage: 'Semi-final', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
    { homeTeam: 'W61', homeFlag: 'br', awayTeam: 'W62', awayFlag: 'de', startTime: new Date('2026-07-19T01:00:00Z'), groupStage: 'Final', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
  ];

  try {
    let created = 0;
    let updated = 0;

    for (let i = 0; i < worldCupMatches.length; i++) {
      const match = worldCupMatches[i];
      const externalId = `wc2026-${i + 1}`;

      const existing = await prisma.match.findFirst({
        where: { externalId }
      });

      if (existing) {
        await prisma.match.update({
          where: { id: existing.id },
          data: {
            homeTeam: match.homeTeam,
            homeFlag: match.homeFlag,
            awayTeam: match.awayTeam,
            awayFlag: match.awayFlag,
            startTime: match.startTime,
            groupStage: match.groupStage,
            venueName: match.venueName,
            venueCity: match.venueCity,
            venueCountry: match.venueCountry,
            status: 'SCHEDULED',
            homeScore: null,
            awayScore: null
          }
        });
        updated++;
      } else {
        await prisma.match.create({
          data: {
            externalId,
            homeTeam: match.homeTeam,
            homeFlag: match.homeFlag,
            awayTeam: match.awayTeam,
            awayFlag: match.awayFlag,
            startTime: match.startTime,
            groupStage: match.groupStage,
            venueName: match.venueName,
            venueCity: match.venueCity,
            venueCountry: match.venueCountry,
            status: 'SCHEDULED'
          }
        });
        created++;
      }
    }

    res.json({ message: `World Cup 2026 seeded successfully`, created, updated, total: worldCupMatches.length });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Seeding failed' });
  }
});

export default router;