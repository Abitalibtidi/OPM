import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate, authorize } from '../middleware/auth';
import { createAuditLog } from '../middleware/audit';
import { config } from '../config';

const router = Router();
const prisma = new PrismaClient();

/**
 * PATCH /api/users/me
 * Update own profile (name, email) or change password. Available to all authenticated users.
 */
router.patch('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const patchSchema = z.object({
      name: z.string().min(1, 'Name is required').optional(),
      email: z.string().email('Invalid email address').optional(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(8, 'Password must be at least 8 characters').optional(),
      confirmPassword: z.string().optional(),
    }).refine(
      (d) => !d.newPassword || d.newPassword === d.confirmPassword,
      { message: 'Passwords do not match', path: ['confirmPassword'] }
    );

    const data = patchSchema.parse(req.body);
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (data.email && data.email !== user.email) {
      const taken = await prisma.user.findFirst({
        where: { email: data.email, NOT: { id: userId } },
      });
      if (taken) {
        res.status(409).json({ error: 'Email is already in use by another account' });
        return;
      }
      updateData.email = data.email;
    }

    if (data.name && data.name !== user.name) {
      updateData.name = data.name;
    }

    if (data.newPassword) {
      if (!data.currentPassword) {
        res.status(400).json({ error: 'Current password is required to set a new password' });
        return;
      }
      const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!valid) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }
      updateData.passwordHash = await bcrypt.hash(data.newPassword, config.bcryptRounds);
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'No changes provided' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, name: true, role: true },
    });

    await createAuditLog({
      userId,
      action: 'user_updated',
      details: `User updated own profile${data.newPassword ? ' (password changed)' : ''}`,
      ipAddress: req.ip,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors.map((e) => e.message).join('; ') });
      return;
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// All routes below require admin role
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
 * POST /api/users
 * Create a new user account (admin only). Unlike /auth/register, this allows
 * setting any role and does not issue a JWT for the new user.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const createSchema = z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      name: z.string().min(1, 'Name is required'),
      role: z.enum(['analyst', 'reviewer', 'admin']).default('analyst'),
    });

    const data = createSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, config.bcryptRounds);

    const user = await prisma.user.create({
      data: { email: data.email, passwordHash, name: data.name, role: data.role },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'user_created',
      details: `Admin created user: ${user.email} (${user.role})`,
      ipAddress: req.ip,
    });

    res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map((e) => e.message).join('; ');
      res.status(400).json({ error: message });
      return;
    }
    console.error('Create user error:', error);
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
