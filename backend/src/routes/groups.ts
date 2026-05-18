import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function authenticate(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization required' });
    return null;
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

router.post('/', async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;

  try {
    const { name } = req.body;
    if (!name || name.trim().length < 3) {
      res.status(400).json({ error: 'El nombre debe tener al menos 3 caracteres' });
      return;
    }

    const code = generateCode();
    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        code,
        ownerId: userId,
        members: {
          create: { userId, role: 'ADMIN' }
        }
      },
      include: { members: true }
    });

    res.status(201).json(group);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Error al crear grupo' });
  }
});

router.get('/my', async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;

  try {
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, image: true, points: true } }
              },
              orderBy: { joinedAt: 'asc' }
            }
          }
        }
      }
    });

    const groups = memberships.map(m => ({
      ...m.group,
      isOwner: m.group.ownerId === userId,
      myRole: m.role
    }));

    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Error al obtener grupos' });
  }
});

router.post('/join', async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;

  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Codigo requerido' });
      return;
    }

    const group = await prisma.group.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!group) {
      res.status(404).json({ error: 'Grupo no encontrado' });
      return;
    }

    const existing = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: group.id } }
    });

    if (existing) {
      res.json({ message: 'Ya eres miembro de este grupo', group });
      return;
    }

    await prisma.groupMember.create({
      data: { userId, groupId: group.id, role: 'MEMBER' }
    });

    res.json({ message: 'Te uniste al grupo exitosamente', group });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ error: 'Error al unirse al grupo' });
  }
});

router.get('/:id/ranking', async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;

  try {
    const { id } = req.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: id } }
    });

    if (!membership) {
      res.status(403).json({ error: 'No eres miembro de este grupo' });
      return;
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            predictions: {
              where: { groupId: id },
              select: { points: true, bonus: true }
            }
          }
        }
      }
    });

    const ranking = members
      .map(m => {
        const totalPoints = m.user.predictions.reduce((sum, p) => sum + p.points, 0);
        const correct = m.user.predictions.filter(p => p.points > 0).length;
        const exact = m.user.predictions.filter(p => p.bonus).length;
        return {
          userId: m.user.id,
          name: m.user.name || 'Sin nombre',
          avatarUrl: m.user.image,
          points: totalPoints,
          predictionsCount: m.user.predictions.length,
          correctPredictions: correct,
          exactScores: exact,
          role: m.role
        };
      })
      .sort((a, b) => b.points - a.points)
      .map((m, index) => ({ ...m, rank: index + 1 }));

    res.json(ranking);
  } catch (error) {
    console.error('Error fetching group ranking:', error);
    res.status(500).json({ error: 'Error al obtener ranking del grupo' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;

  try {
    const { id } = req.params;

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) {
      res.status(404).json({ error: 'Grupo no encontrado' });
      return;
    }

    if (group.ownerId !== userId) {
      res.status(403).json({ error: 'Solo el creador puede eliminar el grupo' });
      return;
    }

    await prisma.group.delete({ where: { id } });
    res.json({ message: 'Grupo eliminado' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Error al eliminar grupo' });
  }
});

router.delete('/:id/leave', async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;

  try {
    const { id } = req.params;

    const group = await prisma.group.findUnique({ where: { id } });
    if (group?.ownerId === userId) {
      res.status(400).json({ error: 'El creador no puede salir del grupo. Eliminalo en su lugar.' });
      return;
    }

    await prisma.groupMember.delete({
      where: { userId_groupId: { userId, groupId: id } }
    });

    res.json({ message: 'Saliste del grupo' });
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).json({ error: 'Error al salir del grupo' });
  }
});

router.put('/:id/members/:memberId/role', async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;

  try {
    const { id, memberId } = req.params;
    const { role } = req.body;

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) {
      res.status(404).json({ error: 'Grupo no encontrado' });
      return;
    }

    const requester = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: id } }
    });

    if (!requester || (requester.role !== 'ADMIN' && group.ownerId !== userId)) {
      res.status(403).json({ error: 'No tienes permiso' });
      return;
    }

    await prisma.groupMember.update({
      where: { userId_groupId: { userId: memberId, groupId: id } },
      data: { role: role === 'ADMIN' ? 'ADMIN' : 'MEMBER' }
    });

    res.json({ message: `Rol actualizado a ${role}` });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
});

export default router;