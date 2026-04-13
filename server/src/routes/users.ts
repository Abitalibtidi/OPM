import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate, authorize } from '../middleware/auth';
import { config } from '../config';

const router = Router();
const prisma = new PrismaClient();

// All routes require admin role
router.use(authenticate, authorize('admin'));

/**
 * GET /api/users
 * List all users (admin only).
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/users/:id
 * Update a user's role or name (admin only).
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      role: z.enum(['analyst', 'reviewer', 'admin']).optional(),
      password: z.string().min(8).optional(),
    });

    const data = updateSchema.parse(req.body);

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, config.bcryptRounds);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/users/:id
 * Delete a user (admin only).
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user!.id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
