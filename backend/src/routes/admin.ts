import { Router, Request, Response } from 'express';
import { PrismaClient, MatchStatus } from '@prisma/client';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

const router = Router();
const prisma = new PrismaClient();
const BACKUP_DIR = '/app/backups';

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
    const { homeTeam, homeFlag, awayTeam, awayFlag, startTime, homeScore, awayScore, status, groupStage, venueName, venueCity, venueCountry } = req.body;

    const match = await prisma.match.update({
      where: { id: parseInt(id) },
      data: {
        ...(homeTeam && { homeTeam }),
        ...(homeFlag && { homeFlag }),
        ...(awayTeam && { awayTeam }),
        ...(awayFlag && { awayFlag }),
        ...(startTime && { startTime: new Date(startTime) }),
        ...(homeScore !== undefined && { homeScore }),
        ...(awayScore !== undefined && { awayScore }),
        ...(status && { status }),
        ...(groupStage !== undefined && { groupStage }),
        ...(venueName !== undefined && { venueName }),
        ...(venueCity !== undefined && { venueCity }),
        ...(venueCountry !== undefined && { venueCountry })
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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { points: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          points: true,
          createdAt: true,
          _count: { select: { predictions: true } }
        }
      }),
      prisma.user.count()
    ]);
    
    res.json({
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.delete('/users/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.prediction.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

router.put('/users/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { points } = req.body;
    const user = await prisma.user.update({
      where: { id },
      data: { points: points ?? undefined },
      select: { id: true, name: true, email: true, points: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
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
    // Group Stage - June 11
    { homeTeam: 'Mexico', homeFlag: 'mx', awayTeam: 'South Africa', awayFlag: 'za', startTime: new Date('2026-06-11T20:00:00Z'), groupStage: 'Group A', venueName: 'Estadio Azteca', venueCity: 'Mexico City', venueCountry: 'Mexico' },
    { homeTeam: 'South Korea', homeFlag: 'kr', awayTeam: 'Czechia', awayFlag: 'cz', startTime: new Date('2026-06-12T05:00:00Z'), groupStage: 'Group A', venueName: 'Estadio Akron', venueCity: 'Zapopan', venueCountry: 'Mexico' },
    // Group Stage - June 12
    { homeTeam: 'Canada', homeFlag: 'ca', awayTeam: 'Bosnia and Herzegovina', awayFlag: 'ba', startTime: new Date('2026-06-12T20:00:00Z'), groupStage: 'Group B', venueName: 'BMO Field', venueCity: 'Toronto', venueCountry: 'Canada' },
    { homeTeam: 'USA', homeFlag: 'us', awayTeam: 'Paraguay', awayFlag: 'py', startTime: new Date('2026-06-13T02:00:00Z'), groupStage: 'Group D', venueName: 'SoFi Stadium', venueCity: 'Inglewood', venueCountry: 'USA' },
    // Group Stage - June 13
    { homeTeam: 'Qatar', homeFlag: 'qa', awayTeam: 'Switzerland', awayFlag: 'ch', startTime: new Date('2026-06-13T20:00:00Z'), groupStage: 'Group B', venueName: "Levi's Stadium", venueCity: 'Santa Clara', venueCountry: 'USA' },
    { homeTeam: 'Brazil', homeFlag: 'br', awayTeam: 'Morocco', awayFlag: 'ma', startTime: new Date('2026-06-13T23:00:00Z'), groupStage: 'Group C', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
    { homeTeam: 'Haiti', homeFlag: 'ht', awayTeam: 'Scotland', awayFlag: 'gb', startTime: new Date('2026-06-14T02:00:00Z'), groupStage: 'Group C', venueName: 'Gillette Stadium', venueCity: 'Foxborough', venueCountry: 'USA' },
    { homeTeam: 'Australia', homeFlag: 'au', awayTeam: 'Türkiye', awayFlag: 'tr', startTime: new Date('2026-06-14T05:00:00Z'), groupStage: 'Group D', venueName: 'BC Place', venueCity: 'Vancouver', venueCountry: 'Canada' },
    // Group Stage - June 14
    { homeTeam: 'Germany', homeFlag: 'de', awayTeam: 'Curaçao', awayFlag: 'cw', startTime: new Date('2026-06-14T18:00:00Z'), groupStage: 'Group E', venueName: 'NRG Stadium', venueCity: 'Houston', venueCountry: 'USA' },
    { homeTeam: 'Netherlands', homeFlag: 'nl', awayTeam: 'Japan', awayFlag: 'jp', startTime: new Date('2026-06-14T21:00:00Z'), groupStage: 'Group F', venueName: 'AT&T Stadium', venueCity: 'Arlington', venueCountry: 'USA' },
    { homeTeam: 'Ivory Coast', homeFlag: 'ci', awayTeam: 'Ecuador', awayFlag: 'ec', startTime: new Date('2026-06-15T00:00:00Z'), groupStage: 'Group E', venueName: 'Lincoln Financial Field', venueCity: 'Philadelphia', venueCountry: 'USA' },
    { homeTeam: 'Sweden', homeFlag: 'se', awayTeam: 'Tunisia', awayFlag: 'tn', startTime: new Date('2026-06-15T03:00:00Z'), groupStage: 'Group F', venueName: 'Estadio BBVA', venueCity: 'Monterrey', venueCountry: 'Mexico' },
    // Group Stage - June 15
    { homeTeam: 'Spain', homeFlag: 'es', awayTeam: 'Cape Verde', awayFlag: 'cv', startTime: new Date('2026-06-15T17:00:00Z'), groupStage: 'Group H', venueName: 'Mercedes-Benz Stadium', venueCity: 'Atlanta', venueCountry: 'USA' },
    { homeTeam: 'Belgium', homeFlag: 'be', awayTeam: 'Egypt', awayFlag: 'eg', startTime: new Date('2026-06-15T20:00:00Z'), groupStage: 'Group G', venueName: 'Lumen Field', venueCity: 'Seattle', venueCountry: 'USA' },
    { homeTeam: 'Saudi Arabia', homeFlag: 'sa', awayTeam: 'Uruguay', awayFlag: 'uy', startTime: new Date('2026-06-15T23:00:00Z'), groupStage: 'Group H', venueName: 'Hard Rock Stadium', venueCity: 'Miami Gardens', venueCountry: 'USA' },
    { homeTeam: 'Iran', homeFlag: 'ir', awayTeam: 'New Zealand', awayFlag: 'nz', startTime: new Date('2026-06-16T02:00:00Z'), groupStage: 'Group G', venueName: 'SoFi Stadium', venueCity: 'Inglewood', venueCountry: 'USA' },
    // Group Stage - June 16
    { homeTeam: 'France', homeFlag: 'fr', awayTeam: 'Senegal', awayFlag: 'sn', startTime: new Date('2026-06-16T20:00:00Z'), groupStage: 'Group I', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
    { homeTeam: 'Iraq', homeFlag: 'iq', awayTeam: 'Norway', awayFlag: 'no', startTime: new Date('2026-06-16T23:00:00Z'), groupStage: 'Group I', venueName: 'Gillette Stadium', venueCity: 'Foxborough', venueCountry: 'USA' },
    { homeTeam: 'Argentina', homeFlag: 'ar', awayTeam: 'Algeria', awayFlag: 'dz', startTime: new Date('2026-06-17T02:00:00Z'), groupStage: 'Group J', venueName: 'Arrowhead Stadium', venueCity: 'Kansas City', venueCountry: 'USA' },
    { homeTeam: 'Austria', homeFlag: 'at', awayTeam: 'Jordan', awayFlag: 'jo', startTime: new Date('2026-06-17T05:00:00Z'), groupStage: 'Group J', venueName: "Levi's Stadium", venueCity: 'Santa Clara', venueCountry: 'USA' },
    // Group Stage - June 17
    { homeTeam: 'Portugal', homeFlag: 'pt', awayTeam: 'DR Congo', awayFlag: 'cd', startTime: new Date('2026-06-17T18:00:00Z'), groupStage: 'Group K', venueName: 'NRG Stadium', venueCity: 'Houston', venueCountry: 'USA' },
    { homeTeam: 'England', homeFlag: 'gb', awayTeam: 'Croatia', awayFlag: 'hr', startTime: new Date('2026-06-17T21:00:00Z'), groupStage: 'Group L', venueName: 'AT&T Stadium', venueCity: 'Arlington', venueCountry: 'USA' },
    { homeTeam: 'Ghana', homeFlag: 'gh', awayTeam: 'Panama', awayFlag: 'pa', startTime: new Date('2026-06-18T00:00:00Z'), groupStage: 'Group L', venueName: 'BMO Field', venueCity: 'Toronto', venueCountry: 'Canada' },
    { homeTeam: 'Uzbekistan', homeFlag: 'uz', awayTeam: 'Colombia', awayFlag: 'co', startTime: new Date('2026-06-18T03:00:00Z'), groupStage: 'Group K', venueName: 'Estadio Azteca', venueCity: 'Mexico City', venueCountry: 'Mexico' },
    // Group Stage - June 18
    { homeTeam: 'Czechia', homeFlag: 'cz', awayTeam: 'South Africa', awayFlag: 'za', startTime: new Date('2026-06-18T17:00:00Z'), groupStage: 'Group A', venueName: 'Mercedes-Benz Stadium', venueCity: 'Atlanta', venueCountry: 'USA' },
    { homeTeam: 'Switzerland', homeFlag: 'ch', awayTeam: 'Bosnia and Herzegovina', awayFlag: 'ba', startTime: new Date('2026-06-18T20:00:00Z'), groupStage: 'Group B', venueName: 'SoFi Stadium', venueCity: 'Inglewood', venueCountry: 'USA' },
    { homeTeam: 'Canada', homeFlag: 'ca', awayTeam: 'Qatar', awayFlag: 'qa', startTime: new Date('2026-06-18T23:00:00Z'), groupStage: 'Group B', venueName: 'BC Place', venueCity: 'Vancouver', venueCountry: 'Canada' },
    { homeTeam: 'Mexico', homeFlag: 'mx', awayTeam: 'South Korea', awayFlag: 'kr', startTime: new Date('2026-06-19T03:00:00Z'), groupStage: 'Group A', venueName: 'Estadio Akron', venueCity: 'Zapopan', venueCountry: 'Mexico' },
    // Group Stage - June 19
    { homeTeam: 'USA', homeFlag: 'us', awayTeam: 'Australia', awayFlag: 'au', startTime: new Date('2026-06-19T20:00:00Z'), groupStage: 'Group D', venueName: 'Lumen Field', venueCity: 'Seattle', venueCountry: 'USA' },
    { homeTeam: 'Scotland', homeFlag: 'gb', awayTeam: 'Morocco', awayFlag: 'ma', startTime: new Date('2026-06-19T23:00:00Z'), groupStage: 'Group C', venueName: 'Gillette Stadium', venueCity: 'Foxborough', venueCountry: 'USA' },
    { homeTeam: 'Brazil', homeFlag: 'br', awayTeam: 'Haiti', awayFlag: 'ht', startTime: new Date('2026-06-20T01:30:00Z'), groupStage: 'Group C', venueName: 'Lincoln Financial Field', venueCity: 'Philadelphia', venueCountry: 'USA' },
    { homeTeam: 'Türkiye', homeFlag: 'tr', awayTeam: 'Paraguay', awayFlag: 'py', startTime: new Date('2026-06-20T04:00:00Z'), groupStage: 'Group D', venueName: "Levi's Stadium", venueCity: 'Santa Clara', venueCountry: 'USA' },
    // Group Stage - June 20
    { homeTeam: 'Netherlands', homeFlag: 'nl', awayTeam: 'Sweden', awayFlag: 'se', startTime: new Date('2026-06-20T18:00:00Z'), groupStage: 'Group F', venueName: 'NRG Stadium', venueCity: 'Houston', venueCountry: 'USA' },
    { homeTeam: 'Germany', homeFlag: 'de', awayTeam: 'Ivory Coast', awayFlag: 'ci', startTime: new Date('2026-06-20T21:00:00Z'), groupStage: 'Group E', venueName: 'BMO Field', venueCity: 'Toronto', venueCountry: 'Canada' },
    { homeTeam: 'Ecuador', homeFlag: 'ec', awayTeam: 'Curaçao', awayFlag: 'cw', startTime: new Date('2026-06-21T01:00:00Z'), groupStage: 'Group E', venueName: 'Arrowhead Stadium', venueCity: 'Kansas City', venueCountry: 'USA' },
    { homeTeam: 'Tunisia', homeFlag: 'tn', awayTeam: 'Japan', awayFlag: 'jp', startTime: new Date('2026-06-21T05:00:00Z'), groupStage: 'Group F', venueName: 'Estadio BBVA', venueCity: 'Monterrey', venueCountry: 'Mexico' },
    // Group Stage - June 21
    { homeTeam: 'Spain', homeFlag: 'es', awayTeam: 'Saudi Arabia', awayFlag: 'sa', startTime: new Date('2026-06-21T17:00:00Z'), groupStage: 'Group H', venueName: 'Mercedes-Benz Stadium', venueCity: 'Atlanta', venueCountry: 'USA' },
    { homeTeam: 'Belgium', homeFlag: 'be', awayTeam: 'Iran', awayFlag: 'ir', startTime: new Date('2026-06-21T20:00:00Z'), groupStage: 'Group G', venueName: 'SoFi Stadium', venueCity: 'Inglewood', venueCountry: 'USA' },
    { homeTeam: 'Uruguay', homeFlag: 'uy', awayTeam: 'Cape Verde', awayFlag: 'cv', startTime: new Date('2026-06-21T23:00:00Z'), groupStage: 'Group H', venueName: 'Hard Rock Stadium', venueCity: 'Miami Gardens', venueCountry: 'USA' },
    { homeTeam: 'New Zealand', homeFlag: 'nz', awayTeam: 'Egypt', awayFlag: 'eg', startTime: new Date('2026-06-22T02:00:00Z'), groupStage: 'Group G', venueName: 'BC Place', venueCity: 'Vancouver', venueCountry: 'Canada' },
    // Group Stage - June 22
    { homeTeam: 'Argentina', homeFlag: 'ar', awayTeam: 'Austria', awayFlag: 'at', startTime: new Date('2026-06-22T18:00:00Z'), groupStage: 'Group J', venueName: 'AT&T Stadium', venueCity: 'Arlington', venueCountry: 'USA' },
    { homeTeam: 'France', homeFlag: 'fr', awayTeam: 'Iraq', awayFlag: 'iq', startTime: new Date('2026-06-22T22:00:00Z'), groupStage: 'Group I', venueName: 'Lincoln Financial Field', venueCity: 'Philadelphia', venueCountry: 'USA' },
    { homeTeam: 'Norway', homeFlag: 'no', awayTeam: 'Senegal', awayFlag: 'sn', startTime: new Date('2026-06-23T01:00:00Z'), groupStage: 'Group I', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
    { homeTeam: 'Jordan', homeFlag: 'jo', awayTeam: 'Algeria', awayFlag: 'dz', startTime: new Date('2026-06-23T04:00:00Z'), groupStage: 'Group J', venueName: "Levi's Stadium", venueCity: 'Santa Clara', venueCountry: 'USA' },
    // Group Stage - June 23
    { homeTeam: 'Portugal', homeFlag: 'pt', awayTeam: 'Uzbekistan', awayFlag: 'uz', startTime: new Date('2026-06-23T18:00:00Z'), groupStage: 'Group K', venueName: 'NRG Stadium', venueCity: 'Houston', venueCountry: 'USA' },
    { homeTeam: 'England', homeFlag: 'gb', awayTeam: 'Ghana', awayFlag: 'gh', startTime: new Date('2026-06-23T21:00:00Z'), groupStage: 'Group L', venueName: 'Gillette Stadium', venueCity: 'Foxborough', venueCountry: 'USA' },
    { homeTeam: 'Panama', homeFlag: 'pa', awayTeam: 'Croatia', awayFlag: 'hr', startTime: new Date('2026-06-24T00:00:00Z'), groupStage: 'Group L', venueName: 'BMO Field', venueCity: 'Toronto', venueCountry: 'Canada' },
    { homeTeam: 'Colombia', homeFlag: 'co', awayTeam: 'DR Congo', awayFlag: 'cd', startTime: new Date('2026-06-24T03:00:00Z'), groupStage: 'Group K', venueName: 'Estadio Akron', venueCity: 'Zapopan', venueCountry: 'Mexico' },
    // Group Stage - June 24 (Final Matchday)
    { homeTeam: 'Switzerland', homeFlag: 'ch', awayTeam: 'Canada', awayFlag: 'ca', startTime: new Date('2026-06-24T20:00:00Z'), groupStage: 'Group B', venueName: 'BC Place', venueCity: 'Vancouver', venueCountry: 'Canada' },
    { homeTeam: 'Bosnia and Herzegovina', homeFlag: 'ba', awayTeam: 'Qatar', awayFlag: 'qa', startTime: new Date('2026-06-24T20:00:00Z'), groupStage: 'Group B', venueName: 'Lumen Field', venueCity: 'Seattle', venueCountry: 'USA' },
    { homeTeam: 'Scotland', homeFlag: 'gb', awayTeam: 'Brazil', awayFlag: 'br', startTime: new Date('2026-06-25T00:00:00Z'), groupStage: 'Group C', venueName: 'Hard Rock Stadium', venueCity: 'Miami Gardens', venueCountry: 'USA' },
    { homeTeam: 'Morocco', homeFlag: 'ma', awayTeam: 'Haiti', awayFlag: 'ht', startTime: new Date('2026-06-25T00:00:00Z'), groupStage: 'Group C', venueName: 'Mercedes-Benz Stadium', venueCity: 'Atlanta', venueCountry: 'USA' },
    { homeTeam: 'Czechia', homeFlag: 'cz', awayTeam: 'Mexico', awayFlag: 'mx', startTime: new Date('2026-06-25T03:00:00Z'), groupStage: 'Group A', venueName: 'Estadio Azteca', venueCity: 'Mexico City', venueCountry: 'Mexico' },
    { homeTeam: 'South Africa', homeFlag: 'za', awayTeam: 'South Korea', awayFlag: 'kr', startTime: new Date('2026-06-25T03:00:00Z'), groupStage: 'Group A', venueName: 'Estadio BBVA', venueCity: 'Monterrey', venueCountry: 'Mexico' },
    // Group Stage - June 25 (Final Matchday)
    { homeTeam: 'Curaçao', homeFlag: 'cw', awayTeam: 'Ivory Coast', awayFlag: 'ci', startTime: new Date('2026-06-25T21:00:00Z'), groupStage: 'Group E', venueName: 'Lincoln Financial Field', venueCity: 'Philadelphia', venueCountry: 'USA' },
    { homeTeam: 'Ecuador', homeFlag: 'ec', awayTeam: 'Germany', awayFlag: 'de', startTime: new Date('2026-06-25T21:00:00Z'), groupStage: 'Group E', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
    { homeTeam: 'Japan', homeFlag: 'jp', awayTeam: 'Sweden', awayFlag: 'se', startTime: new Date('2026-06-26T00:00:00Z'), groupStage: 'Group F', venueName: 'AT&T Stadium', venueCity: 'Arlington', venueCountry: 'USA' },
    { homeTeam: 'Tunisia', homeFlag: 'tn', awayTeam: 'Netherlands', awayFlag: 'nl', startTime: new Date('2026-06-26T00:00:00Z'), groupStage: 'Group F', venueName: 'Arrowhead Stadium', venueCity: 'Kansas City', venueCountry: 'USA' },
    { homeTeam: 'Türkiye', homeFlag: 'tr', awayTeam: 'USA', awayFlag: 'us', startTime: new Date('2026-06-26T03:00:00Z'), groupStage: 'Group D', venueName: 'SoFi Stadium', venueCity: 'Inglewood', venueCountry: 'USA' },
    { homeTeam: 'Paraguay', homeFlag: 'py', awayTeam: 'Australia', awayFlag: 'au', startTime: new Date('2026-06-26T03:00:00Z'), groupStage: 'Group D', venueName: "Levi's Stadium", venueCity: 'Santa Clara', venueCountry: 'USA' },
    // Group Stage - June 26 (Final Matchday)
    { homeTeam: 'Norway', homeFlag: 'no', awayTeam: 'France', awayFlag: 'fr', startTime: new Date('2026-06-26T20:00:00Z'), groupStage: 'Group I', venueName: 'Gillette Stadium', venueCity: 'Foxborough', venueCountry: 'USA' },
    { homeTeam: 'Senegal', homeFlag: 'sn', awayTeam: 'Iraq', awayFlag: 'iq', startTime: new Date('2026-06-26T20:00:00Z'), groupStage: 'Group I', venueName: 'BMO Field', venueCity: 'Toronto', venueCountry: 'Canada' },
    { homeTeam: 'Cape Verde', homeFlag: 'cv', awayTeam: 'Saudi Arabia', awayFlag: 'sa', startTime: new Date('2026-06-27T01:00:00Z'), groupStage: 'Group H', venueName: 'NRG Stadium', venueCity: 'Houston', venueCountry: 'USA' },
    { homeTeam: 'Uruguay', homeFlag: 'uy', awayTeam: 'Spain', awayFlag: 'es', startTime: new Date('2026-06-27T01:00:00Z'), groupStage: 'Group H', venueName: 'Estadio Akron', venueCity: 'Zapopan', venueCountry: 'Mexico' },
    { homeTeam: 'Egypt', homeFlag: 'eg', awayTeam: 'Iran', awayFlag: 'ir', startTime: new Date('2026-06-27T04:00:00Z'), groupStage: 'Group G', venueName: 'Lumen Field', venueCity: 'Seattle', venueCountry: 'USA' },
    { homeTeam: 'New Zealand', homeFlag: 'nz', awayTeam: 'Belgium', awayFlag: 'be', startTime: new Date('2026-06-27T04:00:00Z'), groupStage: 'Group G', venueName: 'BC Place', venueCity: 'Vancouver', venueCountry: 'Canada' },
    // Group Stage - June 27 (Final Matchday)
    { homeTeam: 'Panama', homeFlag: 'pa', awayTeam: 'England', awayFlag: 'gb', startTime: new Date('2026-06-27T22:00:00Z'), groupStage: 'Group L', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
    { homeTeam: 'Croatia', homeFlag: 'hr', awayTeam: 'Ghana', awayFlag: 'gh', startTime: new Date('2026-06-27T22:00:00Z'), groupStage: 'Group L', venueName: 'Lincoln Financial Field', venueCity: 'Philadelphia', venueCountry: 'USA' },
    { homeTeam: 'Colombia', homeFlag: 'co', awayTeam: 'Portugal', awayFlag: 'pt', startTime: new Date('2026-06-28T00:30:00Z'), groupStage: 'Group K', venueName: 'Hard Rock Stadium', venueCity: 'Miami Gardens', venueCountry: 'USA' },
    { homeTeam: 'DR Congo', homeFlag: 'cd', awayTeam: 'Uzbekistan', awayFlag: 'uz', startTime: new Date('2026-06-28T00:30:00Z'), groupStage: 'Group K', venueName: 'Mercedes-Benz Stadium', venueCity: 'Atlanta', venueCountry: 'USA' },
    { homeTeam: 'Algeria', homeFlag: 'dz', awayTeam: 'Austria', awayFlag: 'at', startTime: new Date('2026-06-28T03:00:00Z'), groupStage: 'Group J', venueName: 'Arrowhead Stadium', venueCity: 'Kansas City', venueCountry: 'USA' },
    { homeTeam: 'Jordan', homeFlag: 'jo', awayTeam: 'Argentina', awayFlag: 'ar', startTime: new Date('2026-06-28T03:00:00Z'), groupStage: 'Group J', venueName: 'AT&T Stadium', venueCity: 'Arlington', venueCountry: 'USA' },
    // Round of 32 - June 28
    { homeTeam: 'Runner-up A', homeFlag: 'globe', awayTeam: 'Runner-up B', awayFlag: 'globe', startTime: new Date('2026-06-28T20:00:00Z'), groupStage: 'Round of 32', venueName: 'SoFi Stadium', venueCity: 'Inglewood', venueCountry: 'USA' },
    // Round of 32 - June 29
    { homeTeam: 'Winner C', homeFlag: 'globe', awayTeam: 'Runner-up F', awayFlag: 'globe', startTime: new Date('2026-06-29T18:00:00Z'), groupStage: 'Round of 32', venueName: 'NRG Stadium', venueCity: 'Houston', venueCountry: 'USA' },
    { homeTeam: 'Winner E', homeFlag: 'globe', awayTeam: 'Best 3rd A/B/C/D/F', awayFlag: 'globe', startTime: new Date('2026-06-29T21:30:00Z'), groupStage: 'Round of 32', venueName: 'Gillette Stadium', venueCity: 'Foxborough', venueCountry: 'USA' },
    { homeTeam: 'Winner F', homeFlag: 'globe', awayTeam: 'Runner-up C', awayFlag: 'globe', startTime: new Date('2026-06-30T02:00:00Z'), groupStage: 'Round of 32', venueName: 'Estadio BBVA', venueCity: 'Monterrey', venueCountry: 'Mexico' },
    // Round of 32 - June 30
    { homeTeam: 'Runner-up E', homeFlag: 'globe', awayTeam: 'Runner-up I', awayFlag: 'globe', startTime: new Date('2026-06-30T18:00:00Z'), groupStage: 'Round of 32', venueName: 'AT&T Stadium', venueCity: 'Arlington', venueCountry: 'USA' },
    { homeTeam: 'Winner I', homeFlag: 'globe', awayTeam: 'Best 3rd C/D/F/G/H', awayFlag: 'globe', startTime: new Date('2026-06-30T22:00:00Z'), groupStage: 'Round of 32', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
    { homeTeam: 'Winner A', homeFlag: 'globe', awayTeam: 'Best 3rd C/E/F/H/I', awayFlag: 'globe', startTime: new Date('2026-07-01T02:00:00Z'), groupStage: 'Round of 32', venueName: 'Estadio Azteca', venueCity: 'Mexico City', venueCountry: 'Mexico' },
    // Round of 32 - July 1
    { homeTeam: 'Winner L', homeFlag: 'globe', awayTeam: 'Best 3rd E/H/I/J/K', awayFlag: 'globe', startTime: new Date('2026-07-01T17:00:00Z'), groupStage: 'Round of 32', venueName: 'Mercedes-Benz Stadium', venueCity: 'Atlanta', venueCountry: 'USA' },
    { homeTeam: 'Winner G', homeFlag: 'globe', awayTeam: 'Best 3rd A/E/H/I/J', awayFlag: 'globe', startTime: new Date('2026-07-01T21:00:00Z'), groupStage: 'Round of 32', venueName: 'Lumen Field', venueCity: 'Seattle', venueCountry: 'USA' },
    { homeTeam: 'Winner D', homeFlag: 'globe', awayTeam: 'Best 3rd B/E/F/I/J', awayFlag: 'globe', startTime: new Date('2026-07-02T01:00:00Z'), groupStage: 'Round of 32', venueName: "Levi's Stadium", venueCity: 'Santa Clara', venueCountry: 'USA' },
    // Round of 32 - July 2
    { homeTeam: 'Winner H', homeFlag: 'globe', awayTeam: 'Runner-up J', awayFlag: 'globe', startTime: new Date('2026-07-02T20:00:00Z'), groupStage: 'Round of 32', venueName: 'SoFi Stadium', venueCity: 'Inglewood', venueCountry: 'USA' },
    { homeTeam: 'Runner-up K', homeFlag: 'globe', awayTeam: 'Runner-up L', awayFlag: 'globe', startTime: new Date('2026-07-03T00:00:00Z'), groupStage: 'Round of 32', venueName: 'BMO Field', venueCity: 'Toronto', venueCountry: 'Canada' },
    { homeTeam: 'Winner B', homeFlag: 'globe', awayTeam: 'Best 3rd E/F/G/I/J', awayFlag: 'globe', startTime: new Date('2026-07-03T04:00:00Z'), groupStage: 'Round of 32', venueName: 'BC Place', venueCity: 'Vancouver', venueCountry: 'Canada' },
    // Round of 32 - July 3
    { homeTeam: 'Runner-up D', homeFlag: 'globe', awayTeam: 'Runner-up G', awayFlag: 'globe', startTime: new Date('2026-07-03T19:00:00Z'), groupStage: 'Round of 32', venueName: 'AT&T Stadium', venueCity: 'Arlington', venueCountry: 'USA' },
    { homeTeam: 'Winner J', homeFlag: 'globe', awayTeam: 'Runner-up H', awayFlag: 'globe', startTime: new Date('2026-07-03T23:00:00Z'), groupStage: 'Round of 32', venueName: 'Hard Rock Stadium', venueCity: 'Miami Gardens', venueCountry: 'USA' },
    { homeTeam: 'Winner K', homeFlag: 'globe', awayTeam: 'Best 3rd D/E/I/J/L', awayFlag: 'globe', startTime: new Date('2026-07-04T02:30:00Z'), groupStage: 'Round of 32', venueName: 'Arrowhead Stadium', venueCity: 'Kansas City', venueCountry: 'USA' },
    // Round of 16 - July 4-7
    { homeTeam: 'Winner M73', homeFlag: 'globe', awayTeam: 'Winner M75', awayFlag: 'globe', startTime: new Date('2026-07-04T18:00:00Z'), groupStage: 'Round of 16', venueName: 'NRG Stadium', venueCity: 'Houston', venueCountry: 'USA' },
    { homeTeam: 'Winner M74', homeFlag: 'globe', awayTeam: 'Winner M77', awayFlag: 'globe', startTime: new Date('2026-07-04T22:00:00Z'), groupStage: 'Round of 16', venueName: 'Lincoln Financial Field', venueCity: 'Philadelphia', venueCountry: 'USA' },
    { homeTeam: 'Winner M76', homeFlag: 'globe', awayTeam: 'Winner M78', awayFlag: 'globe', startTime: new Date('2026-07-05T21:00:00Z'), groupStage: 'Round of 16', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
    { homeTeam: 'Winner M79', homeFlag: 'globe', awayTeam: 'Winner M80', awayFlag: 'globe', startTime: new Date('2026-07-06T01:00:00Z'), groupStage: 'Round of 16', venueName: 'Estadio Azteca', venueCity: 'Mexico City', venueCountry: 'Mexico' },
    { homeTeam: 'Winner M83', homeFlag: 'globe', awayTeam: 'Winner M84', awayFlag: 'globe', startTime: new Date('2026-07-06T20:00:00Z'), groupStage: 'Round of 16', venueName: 'AT&T Stadium', venueCity: 'Arlington', venueCountry: 'USA' },
    { homeTeam: 'Winner M81', homeFlag: 'globe', awayTeam: 'Winner M82', awayFlag: 'globe', startTime: new Date('2026-07-07T01:00:00Z'), groupStage: 'Round of 16', venueName: 'Lumen Field', venueCity: 'Seattle', venueCountry: 'USA' },
    { homeTeam: 'Winner M86', homeFlag: 'globe', awayTeam: 'Winner M88', awayFlag: 'globe', startTime: new Date('2026-07-07T17:00:00Z'), groupStage: 'Round of 16', venueName: 'Mercedes-Benz Stadium', venueCity: 'Atlanta', venueCountry: 'USA' },
    { homeTeam: 'Winner M85', homeFlag: 'globe', awayTeam: 'Winner M87', awayFlag: 'globe', startTime: new Date('2026-07-07T21:00:00Z'), groupStage: 'Round of 16', venueName: 'BC Place', venueCity: 'Vancouver', venueCountry: 'Canada' },
    // Quarter-finals - July 9-11
    { homeTeam: 'Winner M89', homeFlag: 'globe', awayTeam: 'Winner M90', awayFlag: 'globe', startTime: new Date('2026-07-09T21:00:00Z'), groupStage: 'Quarter-final', venueName: 'Gillette Stadium', venueCity: 'Foxborough', venueCountry: 'USA' },
    { homeTeam: 'Winner M93', homeFlag: 'globe', awayTeam: 'Winner M94', awayFlag: 'globe', startTime: new Date('2026-07-10T20:00:00Z'), groupStage: 'Quarter-final', venueName: 'SoFi Stadium', venueCity: 'Inglewood', venueCountry: 'USA' },
    { homeTeam: 'Winner M91', homeFlag: 'globe', awayTeam: 'Winner M92', awayFlag: 'globe', startTime: new Date('2026-07-11T22:00:00Z'), groupStage: 'Quarter-final', venueName: 'Hard Rock Stadium', venueCity: 'Miami Gardens', venueCountry: 'USA' },
    { homeTeam: 'Winner M95', homeFlag: 'globe', awayTeam: 'Winner M96', awayFlag: 'globe', startTime: new Date('2026-07-12T02:00:00Z'), groupStage: 'Quarter-final', venueName: 'Arrowhead Stadium', venueCity: 'Kansas City', venueCountry: 'USA' },
    // Semi-finals - July 14-15
    { homeTeam: 'Winner M97', homeFlag: 'globe', awayTeam: 'Winner M98', awayFlag: 'globe', startTime: new Date('2026-07-14T20:00:00Z'), groupStage: 'Semi-final', venueName: 'AT&T Stadium', venueCity: 'Arlington', venueCountry: 'USA' },
    { homeTeam: 'Winner M99', homeFlag: 'globe', awayTeam: 'Winner M100', awayFlag: 'globe', startTime: new Date('2026-07-15T20:00:00Z'), groupStage: 'Semi-final', venueName: 'Mercedes-Benz Stadium', venueCity: 'Atlanta', venueCountry: 'USA' },
    // Third Place - July 18
    { homeTeam: 'Loser M101', homeFlag: 'globe', awayTeam: 'Loser M102', awayFlag: 'globe', startTime: new Date('2026-07-18T22:00:00Z'), groupStage: 'Third Place', venueName: 'Hard Rock Stadium', venueCity: 'Miami Gardens', venueCountry: 'USA' },
    // Final - July 19
    { homeTeam: 'Winner M101', homeFlag: 'globe', awayTeam: 'Winner M102', awayFlag: 'globe', startTime: new Date('2026-07-19T20:00:00Z'), groupStage: 'Final', venueName: 'MetLife Stadium', venueCity: 'East Rutherford', venueCountry: 'USA' },
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

router.get('/backup', adminAuth, async (req: Request, res: Response) => {
  try {
    const [users, matches, predictions] = await Promise.all([
      prisma.user.findMany({ select: { id: true, name: true, email: true, image: true, points: true, isAdmin: true, createdAt: true } }),
      prisma.match.findMany(),
      prisma.prediction.findMany({ select: { id: true, userId: true, matchId: true, homeScore: true, awayScore: true, points: true, bonus: true, createdAt: true } })
    ]);

    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: { users, matches, predictions }
    };

    res.json(backup);
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Backup failed' });
  }
});

router.post('/restore', adminAuth, async (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    
    if (!data || !data.users || !data.matches || !data.predictions) {
      res.status(400).json({ error: 'Formato de backup invalido' });
      return;
    }

    await prisma.prediction.deleteMany();
    await prisma.match.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.createMany({ data: data.users });
    await prisma.match.createMany({ data: data.matches });
    await prisma.prediction.createMany({ data: data.predictions });

    res.json({ message: 'Restauracion completada', 
      users: data.users.length, 
      matches: data.matches.length, 
      predictions: data.predictions.length 
    });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Restore failed' });
  }
});

router.get('/backups', adminAuth, async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      res.json([]);
      return;
    }

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          name: f,
          date: stats.mtime.toISOString(),
          size: stats.size
        };
      });

    res.json(files);
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({ error: 'Error listing backups' });
  }
});

router.get('/backups/:filename', adminAuth, async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    res.json(JSON.parse(content));
  } catch (error) {
    console.error('Download backup error:', error);
    res.status(500).json({ error: 'Error downloading backup' });
  }
});

export default router;