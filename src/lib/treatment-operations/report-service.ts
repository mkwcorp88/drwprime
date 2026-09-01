import type { OpsStaff } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { jakartaDateKey } from './utils';
import { GLOBAL_REPORT_ROLES } from './constants';

type Range = { start: Date; end: Date };

export async function buildSummaryReport(actor: OpsStaff, range: Range) {
  const branchFilter = GLOBAL_REPORT_ROLES.includes(actor.role) ? {} : { branchId: actor.branchId || '' };
  const orders = await prisma.opsTreatmentOrder.findMany({
    where: { ...branchFilter, createdAt: { gte: range.start, lt: range.end } },
    include: {
      actions: {
        include: { performedTherapist: { select: { id: true, name: true, employeeId: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  let totalRevenue = 0;
  let completedActions = 0;
  let totalIncentive = 0;
  const byStatus = new Map<string, number>();
  const byTreatment = new Map<string, { treatmentName: string; orderCount: number; revenue: number }>();
  const byTherapist = new Map<string, { id: string; name: string; employeeId: string; completedActions: number; totalIncentive: number; totalDurationSeconds: number }>();
  const trendMap = new Map<string, { date: string; orders: number; revenue: number }>();

  for (const order of orders) {
    const dayKey = jakartaDateKey(order.createdAt);
    const trend = trendMap.get(dayKey) ?? { date: dayKey, orders: 0, revenue: 0 };
    trend.orders += 1;
    if (order.status !== 'CANCELLED') {
      const revenue = Number(order.finalPrice);
      trend.revenue += revenue;
      totalRevenue += revenue;
    }
    trendMap.set(dayKey, trend);

    byStatus.set(order.status, (byStatus.get(order.status) ?? 0) + 1);

    const treatment = byTreatment.get(order.treatmentId) ?? { treatmentName: order.treatmentNameSnapshot, orderCount: 0, revenue: 0 };
    treatment.orderCount += 1;
    if (order.status !== 'CANCELLED') treatment.revenue += Number(order.finalPrice);
    byTreatment.set(order.treatmentId, treatment);

    for (const action of order.actions) {
      if (action.status !== 'COMPLETED') continue;
      completedActions += 1;
      const incentive = Number(action.calculatedIncentive ?? 0);
      totalIncentive += incentive;
      if (action.performedTherapist) {
        const therapist = byTherapist.get(action.performedTherapist.id) ?? {
          id: action.performedTherapist.id,
          name: action.performedTherapist.name,
          employeeId: action.performedTherapist.employeeId,
          completedActions: 0,
          totalIncentive: 0,
          totalDurationSeconds: 0,
        };
        therapist.completedActions += 1;
        therapist.totalIncentive += incentive;
        therapist.totalDurationSeconds += action.durationSeconds ?? 0;
        byTherapist.set(action.performedTherapist.id, therapist);
      }
    }
  }

  return {
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    summary: {
      totalOrders: orders.length,
      completedOrders: orders.filter((order) => ['COMPLETED', 'VERIFIED'].includes(order.status)).length,
      onProcessOrders: orders.filter((order) => ['ON_PROCESS', 'WAITING_NEXT_ACTION'].includes(order.status)).length,
      cancelledOrders: orders.filter((order) => order.status === 'CANCELLED').length,
      totalRevenue,
      totalIncentive,
      completedActions,
    },
    byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
    byTreatment: [...byTreatment.values()].sort((a, b) => b.orderCount - a.orderCount),
    byTherapist: [...byTherapist.values()].sort((a, b) => b.totalIncentive - a.totalIncentive),
    trend: [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
