import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureUniqueAffiliateCode } from '@/lib/affiliate';
import { ADMIN_USER_IDS, ADMIN_EMAILS } from '@/lib/admin';
import { normalizePhone } from '@/lib/phone';

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

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { email, firstName, lastName, referralCode } = body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId: userId }
    });

    if (existingUser) {
      return NextResponse.json({ user: existingUser });
    }

    // NEW: Check if there's a walk-in member with matching phone/email that we can link
    const { phone } = body; // Assuming phone is passed from sign-up
    const normalizedPhone = phone ? normalizePhone(phone) : null;
    let walkInMember = null;
    
    if (normalizedPhone) {
      walkInMember = await prisma.user.findUnique({
        where: { phone: normalizedPhone },
        select: {
          id: true,
          clerkUserId: true,
          hasAccount: true,
          points: true,
          totalSpending: true,
          spendingRecords: true,
        },
      });

      // If found and it's a walk-in (no clerkUserId yet)
      if (walkInMember && !walkInMember.clerkUserId) {
        console.log(`[USER-LINK] Found walk-in member with phone ${phone}, linking to Clerk user ${userId}`);
      } else {
        walkInMember = null; // Not a valid walk-in to link
      }
    }

    let affiliateCode: string;
    let isTeamLeader = false;

    // Check if there's a pre-assigned code for this email
    const preAssignedCode = await prisma.preClaimAffiliateCode.findFirst({
      where: {
        assignedEmail: email,
        status: 'unclaimed'
      }
    });

    if (preAssignedCode) {
      // Auto-claim the pre-assigned code
      affiliateCode = preAssignedCode.code;
      isTeamLeader = true;
      console.log(`[AFFILIATE] Auto-claiming pre-assigned code ${affiliateCode} for email ${email}`);
    } else if (referralCode) {
      // Check if this code already exists
      const existingCodeUser = await prisma.user.findFirst({
        where: { affiliateCode: referralCode }
      });

      if (existingCodeUser) {
        // Code already claimed - join as team member
        affiliateCode = referralCode;
        isTeamLeader = false;
      } else {
        // Code not claimed yet - claim it as team leader
        // This allows pre-generated codes to be claimed
        affiliateCode = referralCode;
        isTeamLeader = true;
        console.log(`[AFFILIATE] Claiming unclaimed code: ${referralCode}`);
      }
    } else {
      // Generate unique affiliate code for new team leader
      affiliateCode = await ensureUniqueAffiliateCode(
        firstName || '',
        lastName || '',
        async (code) => {
          const exists = await prisma.user.findFirst({
            where: { affiliateCode: code }
          });
          return !exists;
        }
      );
      isTeamLeader = true;
    }

    // Check if user is admin (by Clerk User ID or email)
    const isAdmin = ADMIN_USER_IDS.includes(userId) || ADMIN_EMAILS.includes(email);

    // Create OR update user (link walk-in member)
    let user;
    if (walkInMember) {
      // Update existing walk-in member record
      user = await prisma.user.update({
        where: { id: walkInMember.id },
        data: {
          clerkUserId: userId,
          email,
          firstName: firstName || undefined, // Keep walk-in name if not provided
          lastName: lastName || undefined,
          affiliateCode: affiliateCode || undefined,
          isTeamLeader,
          hasAccount: true, // Mark as having an account now
          isAdmin,
        },
      });
      console.log(`[USER-LINK] Successfully linked walk-in member ${walkInMember.id} to Clerk user ${userId}`);
    } else {
      // Create new user from scratch
      user = await prisma.user.create({
        data: {
          clerkUserId: userId,
          email,
          firstName,
          lastName,
          phone: phone || undefined,
          affiliateCode,
          isTeamLeader,
          hasAccount: true,
          isAdmin,
        },
      });
    }

    // If claiming an unclaimed code (either pre-assigned or referral), transfer all pending reservations
    if (isTeamLeader && (preAssignedCode || referralCode)) {
      const codeToUpdate = preAssignedCode?.code || referralCode;
      
      // Update PreClaimAffiliateCode status to claimed
      await prisma.preClaimAffiliateCode.updateMany({
        where: {
          code: codeToUpdate,
          status: 'unclaimed'
        },
        data: {
          status: 'claimed',
          claimedBy: user.id,
          claimedAt: new Date()
        }
      });

      console.log(`[AFFILIATE] Updated PreClaimAffiliateCode status to claimed for: ${codeToUpdate}`);

      // Find all reservations with this referral code but no referrerId
      const pendingReservations = await prisma.reservation.findMany({
        where: {
          referredBy: codeToUpdate,
          referrerId: null
        }
      });

      if (pendingReservations.length > 0) {
        // Update all pending reservations to link to this user
        await prisma.reservation.updateMany({
          where: {
            referredBy: codeToUpdate,
            referrerId: null
          },
          data: {
            referrerId: user.id
          }
        });

        console.log(`[AFFILIATE] Transferred ${pendingReservations.length} pending reservations to user ${user.id}`);
      }
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error syncing user:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return NextResponse.json(
      { 
        error: 'Failed to sync user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        reservations: {
          include: {
            treatment: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        referrals: {
          where: {
            status: 'completed'
          },
          include: {
            treatment: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        transactions: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        },
        bankAccounts: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        withdrawals: {
          include: {
            bankAccount: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    // If user doesn't exist, return null data (client will sync via POST)
    if (!user) {
      return NextResponse.json({ 
        user: null,
        needsSync: true 
      }, { status: 200 });
    }

    // Recalculate admin status from hardcoded list (in case DB is stale)
    const isAdmin = user.isAdmin || ADMIN_USER_IDS.includes(userId) || (user.email ? ADMIN_EMAILS.includes(user.email) : false);
    if (isAdmin && !user.isAdmin) {
      await prisma.user.update({
        where: { clerkUserId: userId },
        data: { isAdmin: true }
      });
    }

    // Calculate additional fields
    const totalReferrals = user.referrals.length;
    const loyaltyLevel = getLoyaltyLevel(user.loyaltyPoints);

    // Get team members count (users with same affiliate code)
    const teamMembersCount = await prisma.user.count({
      where: { 
        affiliateCode: user.affiliateCode,
        clerkUserId: { not: userId } // Exclude self
      }
    });

    return NextResponse.json({ 
      user: {
        ...user,
        phone: user.phone ? normalizePhone(user.phone) : null,
        isAdmin,
        totalReferrals,
        loyaltyLevel,
        teamMembersCount
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

function getLoyaltyLevel(points: number): string {
  if (points >= 10000) return 'Platinum';
  if (points >= 5000) return 'Gold';
  if (points >= 1000) return 'Silver';
  return 'Bronze';
}
