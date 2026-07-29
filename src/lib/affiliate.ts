/**
 * Generate a 5-digit affiliate code from user's name
 * Format: 2 letters from first name + 3 random alphanumeric
 * Example: "John Doe" -> "JO5X9"
 */
import { calculateCommission as calcCommission, calculateCommissionPoints } from '@/lib/policies/commission';

export function generateAffiliateCode(firstName: string = ''): string {
  // Get first 2 letters from first name, uppercase
  const firstPart = firstName.slice(0, 2).toUpperCase() || 'XX';
  
  // Generate 3 random alphanumeric characters
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  for (let i = 0; i < 3; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return firstPart + randomPart;
}

/**
 * Check if affiliate code is unique in database
 */
export async function ensureUniqueAffiliateCode(
  firstName: string, 
  lastName: string,
  checkUnique: (code: string) => Promise<boolean>
): Promise<string> {
  let code = generateAffiliateCode(firstName);
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const isUnique = await checkUnique(code);
    if (isUnique) {
      return code;
    }
    code = generateAffiliateCode(firstName);
    attempts++;
  }
  
  // Fallback: generate completely random code
  return 'AF' + Math.random().toString(36).substring(2, 5).toUpperCase();
}

/**
 * Calculate commission based on treatment price
 * Default: 10% commission
 */
/**
 * @deprecated Use calculateCommission from @/lib/policies/commission instead.
 */
export function calculateCommission(price: number, rate: number = 0.10): number {
  return calcCommission(price, rate);
}

/**
 * @deprecated Use calculateLoyaltyPoints from @/lib/policies/loyalty instead.
 */
export function calculateLoyaltyPoints(amount: number): number {
  return Math.floor(amount / 1000);
}

/**
 * @deprecated Use getLoyaltyTier from @/lib/policies/loyalty instead.
 */
export function getLoyaltyLevel(points: number): string {
  if (points >= 10000) return 'Platinum';
  if (points >= 5000) return 'Gold';
  if (points >= 2000) return 'Silver';
  return 'Bronze';
}

/**
 * Generate unique voucher redemption code
 */
export function generateVoucherCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `VC-${timestamp}-${random}`;
}

/**
 * Validate affiliate code format and content
 * Rules:
 * - Length: 5-10 characters
 * - Only alphanumeric (A-Z, 0-9)
 * - No forbidden words
 */
export function validateAffiliateCode(code: string): { valid: boolean; error?: string } {
  // Check length
  if (!code || code.length < 5 || code.length > 10) {
    return { valid: false, error: 'Kode affiliate harus 5-10 karakter' };
  }

  // Check format (only alphanumeric)
  const alphanumericRegex = /^[A-Z0-9]+$/;
  if (!alphanumericRegex.test(code.toUpperCase())) {
    return { valid: false, error: 'Kode hanya boleh huruf dan angka (A-Z, 0-9)' };
  }

  // Forbidden words/patterns
  const forbiddenWords = [
    'ADMIN', 'STAFF', 'SYSTEM', 'NULL', 'UNDEFINED',
    'FUCK', 'SHIT', 'DAMN', 'BASTARD', 'BITCH',
    'ANJING', 'KONTOL', 'MEMEK', 'BANGSAT', 'TOLOL'
  ];

  const upperCode = code.toUpperCase();
  for (const word of forbiddenWords) {
    if (upperCode.includes(word)) {
      return { valid: false, error: 'Kode mengandung kata yang tidak diperbolehkan' };
    }
  }

  return { valid: true };
}

/**
 * Check if user can update affiliate code based on last update time
 * Rule: No time limit - users can update anytime
 */
export function canUpdateAffiliateCode(lastUpdatedAt: Date | null): { allowed: boolean; daysRemaining?: number } {
  // Always allow updates - no time restriction
  return { allowed: true };
}
