import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export type OtpFlow = 'member' | 'staff' | 'ops';
export type MetaOtpSubmission = {
  messageId: string;
  messageStatus: 'accepted' | 'held_for_quality_assessment' | 'unspecified';
};

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export async function recordOtpSubmission(flow: OtpFlow, challengeId: string, submission: MetaOtpSubmission): Promise<void> {
  await prisma.whatsAppOtpDispatch.create({ data: {
    messageIdHash: hash(submission.messageId),
    challengeIdHash: hash(challengeId),
    flow,
    status: submission.messageStatus === 'held_for_quality_assessment' ? 'held' : 'accepted',
  } });
  await prisma.whatsAppOtpDispatch.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });
}

export type MetaMessageStatus = {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  errorCode?: number;
};

export async function applyMetaMessageStatus(message: MetaMessageStatus): Promise<void> {
  const allowedPrevious: Record<MetaMessageStatus['status'], string[]> = {
    sent: ['accepted', 'held'],
    delivered: ['accepted', 'held', 'sent'],
    read: ['accepted', 'held', 'sent', 'delivered'],
    failed: ['accepted', 'held', 'sent'],
  };
  await prisma.whatsAppOtpDispatch.updateMany({
    where: { messageIdHash: hash(message.id), status: { in: allowedPrevious[message.status] } },
    data: { status: message.status, errorCode: message.status === 'failed' ? message.errorCode ?? null : null },
  });
}
