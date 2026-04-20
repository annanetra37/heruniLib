import { prisma } from './prisma';

export async function logAudit(args: {
  actorId?: number | null;
  action: string;
  entity: 'root' | 'word' | 'submission' | 'editor';
  entityId?: number | null;
  diff?: Record<string, unknown> | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: args.actorId ?? null,
      action: args.action,
      entity: args.entity,
      entityId: args.entityId ?? null,
      diff: args.diff ? JSON.stringify(args.diff) : null
    }
  });
}
