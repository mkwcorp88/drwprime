import { NextResponse } from 'next/server';
import { requireOpsStaff, resolveStaffBadge } from '@/lib/treatment-operations/auth';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { completeAction } from '@/lib/treatment-operations/order-service';
import { handleOrderCompletionPointsAndNotification } from '@/lib/treatment-operations/order-completion';
import { OpsError } from '@/lib/treatment-operations/utils';
import { sendSpendingNotification } from '@/lib/whatsapp';

const KIOSK_ROLES = ['SUPER_ADMIN', 'MANAGEMENT', 'FRONT_OFFICE', 'SUPERVISOR'] as const;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff();
    const { id } = await context.params;
    const body = await readJson(request);

    let performer;
    if (typeof body.badgeToken === 'string' && body.badgeToken.trim()) {
      if (!KIOSK_ROLES.includes(actor.role as (typeof KIOSK_ROLES)[number])) {
        throw new OpsError(403, 'Role Anda tidak dapat memindai kartu terapis untuk tindakan ini.');
      }
      performer = await resolveStaffBadge(body.badgeToken, ['THERAPIST']);
    } else {
      if (actor.role !== 'THERAPIST') throw new OpsError(403, 'Terapis harus login sendiri atau gunakan scan kartu terapis.');
      performer = actor;
    }

    const { updated, isOrderCompleted } = await completeAction(performer, id, typeof body.note === 'string' ? body.note.trim() : undefined);

    // Process points and notification if order is completed
    if (isOrderCompleted) {
      const pointsResult = await handleOrderCompletionPointsAndNotification(updated.treatmentOrderId);
      if (pointsResult && pointsResult.user.phone) {
        // Asynchronous notification (fire-and-forget)
        sendSpendingNotification({
          memberName: [pointsResult.user.firstName, pointsResult.user.lastName].filter(Boolean).join(' ') || 'Member',
          memberPhone: pointsResult.user.phone,
          isWalkIn: !pointsResult.user.hasAccount,
          isFirstTransaction: pointsResult.isNewMember,
          amount: Number(pointsResult.order.finalPrice),
          pointsEarned: pointsResult.pointsEarned,
          totalPoints: pointsResult.user.points,
          totalSpending: pointsResult.newTotalSpending,
          tier: pointsResult.newTier,
          treatment: pointsResult.order.treatmentNameSnapshot,
          transactionCount: pointsResult.transactionCount,
        }).catch((err) => console.warn('[WA] Spending notification failed:', err));
      }
    }

    return NextResponse.json({
      action: updated,
    });
  } catch (error) {
    return handleOpsError(error, 'complete action');
  }
}
