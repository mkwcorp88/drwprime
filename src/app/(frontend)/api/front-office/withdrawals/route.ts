import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';

// GET - Get all withdrawal requests
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { userId } = await auth();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';

    const whereClause: { status?: string } = {};
    
    if (status !== 'all') {
      whereClause.status = status;
    }

    const withdrawals = await prisma.withdrawal.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            affiliateCode: true,
            totalEarnings: true
          }
        },
        bankAccount: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      withdrawals
    }, { status: 200 });

  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO WITHDRAWAL] Error fetching withdrawals:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data penarikan' },
      { status: 500 }
    );
  }
}

// PATCH - Update withdrawal status
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const { userId } = await auth();

    const body = await req.json();
    const { withdrawalId, status, adminNotes } = body;

    if (!withdrawalId || !status) {
      return NextResponse.json({ error: 'withdrawalId dan status harus diisi' }, { status: 400 });
    }

    // Get withdrawal
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        user: true,
        bankAccount: true
      }
    });

    if (!withdrawal) {
      return NextResponse.json({ error: 'Penarikan tidak ditemukan' }, { status: 404 });
    }

    // If status is being changed to rejected, return the money to user
    if (status === 'rejected' && withdrawal.status === 'pending') {
      await prisma.user.update({
        where: { id: withdrawal.userId },
        data: {
          totalEarnings: {
            increment: parseFloat(withdrawal.amount.toString())
          }
        }
      });
      console.log(`[FO WITHDRAWAL] Returned ${withdrawal.amount} to user ${withdrawal.user.email} due to rejection`);
    }

    // Update withdrawal
    const updatedWithdrawal = await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status,
        adminNotes: adminNotes || withdrawal.adminNotes,
        processedDate: new Date(),
        processedBy: userId
      },
      include: {
        user: true,
        bankAccount: true
      }
    });

    console.log(`[FO WITHDRAWAL] Updated withdrawal ${withdrawalId} to status ${status} by admin ${userId}`);

    return NextResponse.json({
      success: true,
      withdrawal: updatedWithdrawal
    }, { status: 200 });

  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO WITHDRAWAL] Error updating withdrawal:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui status penarikan' },
      { status: 500 }
    );
  }
}
