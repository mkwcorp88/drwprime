import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { validateAffiliateCode, canUpdateAffiliateCode } from '@/lib/affiliate';

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { newAffiliateCode } = body;

    if (!newAffiliateCode) {
      return NextResponse.json(
        { error: 'Kode affiliate baru diperlukan' },
        { status: 400 }
      );
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        id: true,
        affiliateCode: true,
        affiliateCodeUpdatedAt: true,
        affiliateCodeHistory: true,
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 404 }
      );
    }

    // Normalize code to uppercase
    const normalizedCode = newAffiliateCode.toUpperCase().trim();

    // Check if same as current code
    if (normalizedCode === user.affiliateCode) {
      return NextResponse.json(
        { error: 'Kode baru sama dengan kode saat ini' },
        { status: 400 }
      );
    }

    // Validate code format
    const validation = validateAffiliateCode(normalizedCode);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Check rate limiting (90 days)
    const rateLimitCheck = canUpdateAffiliateCode(user.affiliateCodeUpdatedAt);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { 
          error: `Anda hanya bisa mengubah kode affiliate setiap 90 hari. Silakan coba lagi dalam ${rateLimitCheck.daysRemaining} hari.`,
          daysRemaining: rateLimitCheck.daysRemaining
        },
        { status: 429 }
      );
    }

    // Check if code already exists (uniqueness)
    const existingUser = await prisma.user.findFirst({
      where: { affiliateCode: normalizedCode }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Kode affiliate sudah digunakan. Silakan pilih kode lain.' },
        { status: 409 }
      );
    }

    // Check if code was previously used by this user (prevent recycling old codes)
    if (user.affiliateCodeHistory.includes(normalizedCode)) {
      return NextResponse.json(
        { error: 'Anda tidak dapat menggunakan kembali kode affiliate lama.' },
        { status: 400 }
      );
    }

    // Update affiliate code
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        affiliateCode: normalizedCode,
        affiliateCodeUpdatedAt: new Date(),
        ...(user.affiliateCode ? {
          affiliateCodeHistory: {
            push: user.affiliateCode
          }
        } : {}),
      },
      select: {
        affiliateCode: true,
        affiliateCodeUpdatedAt: true,
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Kode affiliate berhasil diperbarui',
      data: {
        affiliateCode: updatedUser.affiliateCode,
        updatedAt: updatedUser.affiliateCodeUpdatedAt
      }
    });

  } catch (error) {
    console.error('Error updating affiliate code:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui kode affiliate' },
      { status: 500 }
    );
  }
}

// Get affiliate code info
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        affiliateCode: true,
        affiliateCodeUpdatedAt: true,
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 404 }
      );
    }

    // Check if can update
    const canUpdate = canUpdateAffiliateCode(user.affiliateCodeUpdatedAt);

    return NextResponse.json({
      affiliateCode: user.affiliateCode,
      lastUpdated: user.affiliateCodeUpdatedAt,
      canUpdate: canUpdate.allowed,
      daysRemaining: canUpdate.daysRemaining || 0
    });

  } catch (error) {
    console.error('Error fetching affiliate code info:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}
