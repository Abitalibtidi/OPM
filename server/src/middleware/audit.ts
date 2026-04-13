import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create an audit log entry.
 * Called explicitly by route handlers after significant actions.
 */
export async function createAuditLog(params: {
  userId: string;
  valuationId?: string;
  action: string;
  details: string;
  ipAddress?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        valuationId: params.valuationId,
        action: params.action,
        details: params.details,
        ipAddress: params.ipAddress || undefined,
      },
    });
  } catch (error) {
    // Log but don't throw - audit failures shouldn't break operations
    console.error('Failed to create audit log:', error);
  }
}
