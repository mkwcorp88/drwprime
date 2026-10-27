import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError, AuthError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const { codeId, email } = await request.json();

    if (!codeId || !email) {
      return NextResponse.json(
        { error: 'Code ID and email are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
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

    // Check if code is already assigned
    if (code.assignedEmail) {
      return NextResponse.json(
        { error: 'Code is already assigned to another email' },
        { status: 400 }
      );
    }

    // Assign email to code
    const updatedCode = await prisma.preClaimAffiliateCode.update({
      where: { id: codeId },
      data: {
        assignedEmail: email
      }
    });

    return NextResponse.json({
      success: true,
      code: updatedCode
    });

  } catch (error) {
    if (error instanceof AuthError) return handleAuthError(error);
    console.error('Error assigning code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
