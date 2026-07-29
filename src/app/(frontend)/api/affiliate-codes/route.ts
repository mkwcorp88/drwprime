import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';

// Generate random affiliate code
function generateAffiliateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET - List all pre-claim codes
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';

    const whereClause: Record<string, unknown> = {};
    
    if (status !== 'all') {
      whereClause.status = status;
    }

    const codes = await prisma.preClaimAffiliateCode.findMany({
      where: whereClause,
      orderBy: [
        { status: 'asc' }, // unclaimed first
        { createdAt: 'desc' }
      ]
    });

    // Get usage stats for each code
    const codesWithStats = await Promise.all(
      codes.map(async (code) => {
        const reservationCount = await prisma.reservation.count({
          where: { referredBy: code.code }
        });

        const totalCommission = await prisma.reservation.aggregate({
          where: { 
            referredBy: code.code,
            status: 'completed'
          },
          _sum: {
            commissionAmount: true
          }
        });

        // Get bank account info for claimed codes
        let bankAccount = null;
        if (code.claimedBy) {
          const user = await prisma.user.findUnique({
            where: { clerkUserId: code.claimedBy },
            include: {
              bankAccounts: {
                where: { isDefault: true },
                take: 1
              }
            }
          });
          bankAccount = user?.bankAccounts[0] || null;
        }

        return {
          ...code,
          reservationCount,
          totalCommission: totalCommission._sum.commissionAmount || 0,
          bankAccount
        };
      })
    );

    return NextResponse.json({ codes: codesWithStats });
  } catch (error) {
    console.error('Error fetching affiliate codes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch affiliate codes' },
      { status: 500 }
    );
  }
}

// POST - Generate new pre-claim code
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { customCode, notes, createdBy } = body;

    let code = customCode?.toUpperCase().trim();

    // If no custom code provided, generate random one
    if (!code) {
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        code = generateAffiliateCode();
        
        // Check if code already exists in pre-claim table
        const existingPreClaim = await prisma.preClaimAffiliateCode.findUnique({
          where: { code }
        });

        // Check if code already exists in users table
        const existingUser = await prisma.user.findFirst({
          where: { affiliateCode: code }
        });

        if (!existingPreClaim && !existingUser) {
          break;
        }

        attempts++;
      }

      if (attempts >= maxAttempts) {
        return NextResponse.json(
          { error: 'Failed to generate unique code. Please try again.' },
          { status: 500 }
        );
      }
    } else {
      // Validate custom code format
      if (!/^[A-Z0-9]{4,10}$/.test(code)) {
        return NextResponse.json(
          { error: 'Kode harus 4-10 karakter (huruf kapital dan angka saja)' },
          { status: 400 }
        );
      }

      // Check if code already exists
      const existingPreClaim = await prisma.preClaimAffiliateCode.findUnique({
        where: { code }
      });

      const existingUser = await prisma.user.findFirst({
        where: { affiliateCode: code }
      });

      if (existingPreClaim || existingUser) {
        return NextResponse.json(
          { error: 'Kode sudah digunakan. Pilih kode lain.' },
          { status: 400 }
        );
      }
    }

    // Create the pre-claim code
    const newCode = await prisma.preClaimAffiliateCode.create({
      data: {
        code,
        notes: notes || null,
        createdBy: createdBy || null
      }
    });

    console.log(`[AFFILIATE] Generated new pre-claim code: ${code}`);

    return NextResponse.json({ 
      code: newCode,
      message: 'Kode affiliate berhasil dibuat'
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('Error creating affiliate code:', error);
    return NextResponse.json(
      { error: 'Failed to create affiliate code' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a pre-claim code
export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const codeId = searchParams.get('id');

    if (!codeId) {
      return NextResponse.json(
        { error: 'Code ID required' },
        { status: 400 }
      );
    }

    // Check if code exists
    const code = await prisma.preClaimAffiliateCode.findUnique({
      where: { id: codeId }
    });

    if (!code) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    // Check if code has been claimed
    if (code.status === 'claimed') {
      return NextResponse.json(
        { error: 'Tidak bisa menghapus kode yang sudah di-claim' },
        { status: 400 }
      );
    }

    // Check if code has been used in reservations
    const reservationCount = await prisma.reservation.count({
      where: { referredBy: code.code }
    });

    if (reservationCount > 0) {
      return NextResponse.json(
        { error: 'Tidak bisa menghapus kode yang sudah digunakan untuk reservasi' },
        { status: 400 }
      );
    }

    // Delete the code
    await prisma.preClaimAffiliateCode.delete({
      where: { id: codeId }
    });

    return NextResponse.json({ 
      message: 'Kode berhasil dihapus',
      deletedId: codeId
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('Error deleting affiliate code:', error);
    return NextResponse.json(
      { error: 'Failed to delete affiliate code' },
      { status: 500 }
    );
  }
}
