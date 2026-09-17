import { NextResponse } from 'next/server';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { ORDER_COMPLETION_CONFIRMATION_ROLES } from '@/lib/treatment-operations/constants';
import { handleOpsError } from '@/lib/treatment-operations/http';
import { confirmOrderCompletion } from '@/lib/treatment-operations/order-service';
import { handleOrderCompletionPointsAndNotification } from '@/lib/treatment-operations/order-completion';
import { sendTreatmentCompletedNotification } from '@/lib/whatsapp';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff(ORDER_COMPLETION_CONFIRMATION_ROLES);
    const { id } = await context.params;
    const order = await confirmOrderCompletion(actor, id);
    const pointsResult = await handleOrderCompletionPointsAndNotification(order.id);

    if (pointsResult?.notificationPhone) {
      try {
        await sendTreatmentCompletedNotification({
          memberPhone: pointsResult.notificationPhone,
          hasAccount: pointsResult.user.hasAccount,
          amount: Number(pointsResult.order.finalPrice),
          pointsEarned: pointsResult.pointsEarned,
          totalPoints: pointsResult.user.points,
          tier: pointsResult.newTier,
          treatment: pointsResult.order.treatmentNameSnapshot,
        });
      } catch (error) {
        console.warn('[WA] Treatment completion notification failed:', error);
      }
    }

    return NextResponse.json({ order });
  } catch (error) {
    return handleOpsError(error, 'confirm order completion');
  }
}
