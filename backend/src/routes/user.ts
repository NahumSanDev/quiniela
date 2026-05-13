import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function authMiddleware(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' });
    return;
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.headers['x-user-id'] = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

router.get('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        points: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    const totalUsers = await prisma.user.count();
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

    const totalPredictions = await prisma.prediction.count({
      where: { userId }
    });

    const correctPredictions = await prisma.prediction.count({
      where: {
        userId,
        points: { gt: 0 }
      }
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.image,
        points: user.points,
        createdAt: user.createdAt
      },
      stats: {
        position: position + 1,
        totalUsers,
        totalPredictions,
        correctPredictions,
        accuracy: totalPredictions > 0 ? Math.round((correctPredictions / totalPredictions) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.get('/predictions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    const predictions = await prisma.prediction.findMany({
      where: { userId },
      include: {
        match: true
      },
      orderBy: { match: { startTime: 'desc' } }
    });

    res.json(predictions);
  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    const history = await prisma.prediction.findMany({
      where: {
        userId,
        match: {
          status: 'FINISHED'
        }
      },
      include: {
        match: true
      },
      orderBy: { match: { startTime: 'desc' } }
    });

    const totalPoints = history.reduce((sum, p) => sum + p.points, 0);
    const totalBonus = history.filter(p => p.bonus).length;

    res.json({
      matches: history,
      summary: {
        totalMatches: history.length,
        totalPoints,
        totalBonus,
        perfectMatches: totalBonus
      }
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

export default router;