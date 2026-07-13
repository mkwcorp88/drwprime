import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: {
        profileCompletedAt: { not: null },
      },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        affiliateCode: true,
        phone: true,
        nik: true,
        gender: true,
        dateOfBirth: true,
        address: true,
        city: true,
        province: true,
        postalCode: true,
        profileCompletedAt: true,
        points: true,
        loyaltyPoints: true,
        loyaltyLevel: true,
        totalEarnings: true,
        totalReferrals: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true, description: true, points: true },
        },
        reservations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true, status: true, treatment: { select: { name: true } } },
        },
      },
      orderBy: {
        profileCompletedAt: 'desc',
      },
    });

    const profiles = users.map((u) => ({
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email,
      affiliateCode: u.affiliateCode,
      phone: u.phone || '',
      nik: u.nik || '',
      gender: u.gender || '',
      dateOfBirth: u.dateOfBirth ? u.dateOfBirth.toISOString() : null,
      address: u.address || '',
      city: u.city || '',
      province: u.province || '',
      postalCode: u.postalCode || '',
      profileCompletedAt: u.profileCompletedAt ? u.profileCompletedAt.toISOString() : null,
      points: u.points,
      loyaltyPoints: u.loyaltyPoints,
      loyaltyLevel: u.loyaltyLevel,
      totalEarnings: Number(u.totalEarnings),
      totalReferrals: u.totalReferrals,
      lastTransaction: u.transactions[0] ? {
        date: u.transactions[0].createdAt.toISOString(),
        description: u.transactions[0].description,
      } : null,
      lastReservation: u.reservations[0] ? {
        date: u.reservations[0].createdAt.toISOString(),
        treatment: u.reservations[0].treatment.name,
        status: u.reservations[0].status,
      } : null,
    }));

    return NextResponse.json({
      success: true,
      profiles,
      total: profiles.length,
    });
  } catch (error) {
    console.error('Error fetching completed profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch completed profiles' },
      { status: 500 }
    );
  }
}
