/**
 * Normalize Indonesian phone number to 62xxxx format (without + prefix, without leading 0).
 *
 * Accepts: "08123456789", "8123456789", "+628123456789", "628123456789", "0812-3456-789"
 * Returns: "82123456789" (62 prefix is implied)
 *
 * Returns the input unchanged if it cannot be parsed.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return phone;

  // Remove all non-digit characters
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // Handle +62 prefix
  if (cleaned.startsWith('+62')) {
    cleaned = cleaned.substring(3);
  }
  // Handle 62 prefix
  else if (cleaned.startsWith('62') && cleaned.length >= 10) {
    cleaned = cleaned.substring(2);
  }
  // Handle 0 prefix (most common - 08xx)
  else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Validate minimum length for Indonesian phone
  if (cleaned.length < 8 || cleaned.length > 13) {
    return phone; // Return original if validation fails
  }

  return cleaned;
}

/**
 * Format phone for display with country code.
 * "82123456789" → "+62 821-2345-6789"
 */
export function formatPhone(phone: string): string {
  if (!phone) return '-';
  const normalized = normalizePhone(phone);
  if (normalized.length < 8) return phone;

  const main = normalized.substring(0, normalized.length);
  const parts = main.length <= 10
    ? [main.substring(0, 3), main.substring(3, 7), main.substring(7)]
    : [main.substring(0, 4), main.substring(4, 8), main.substring(8)];

  return '+62 ' + parts.filter(Boolean).join('-');
}
