import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { approveWithdrawal, rejectWithdrawal, WithdrawalError } from '@/lib/services/withdrawal';

// GET - Get all withdrawal requests
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

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
    const { clerkUserId: userId } = await requireAdmin();

    const body = await req.json();
    const { withdrawalId, status, adminNotes } = body;

    if (!withdrawalId || !status) {
      return NextResponse.json({ error: 'withdrawalId dan status harus diisi' }, { status: 400 });
    }
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: 'Status harus approved atau rejected' }, { status: 400 });
    }

    const updatedWithdrawal = status === 'approved'
      ? await approveWithdrawal(withdrawalId, userId)
      : await rejectWithdrawal(withdrawalId, userId, adminNotes);

    const withdrawalWithDetails = await prisma.withdrawal.findUnique({
      where: { id: updatedWithdrawal.id },
      include: {
        user: true,
        bankAccount: true
      }
    });

    console.log(`[FO WITHDRAWAL] Updated withdrawal ${withdrawalId} to status ${status} by admin ${userId}`);

    return NextResponse.json({
      success: true,
      withdrawal: withdrawalWithDetails
    }, { status: 200 });

  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    if (error instanceof WithdrawalError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[FO WITHDRAWAL] Error updating withdrawal:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui status penarikan' },
      { status: 500 }
    );
  }
}
