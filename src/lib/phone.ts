/**
 * Normalize Indonesian phone number to 62xxxx format.
 *
 * Accepts: "08123456789", "8123456789", "+628123456789", "628123456789", "0812-3456-789"
 * Returns: "628123456789"
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

  // Validate minimum length for Indonesian phone (the core 8xx part)
  if (cleaned.length < 8 || cleaned.length > 13) {
    return phone; // Return original if validation fails
  }

  return '62' + cleaned;
}

/**
 * Format phone for display with country code space.
 * "628123456789" → "+62 812-3456-789"
 */
export function formatPhone(phone: string): string {
  if (!phone) return '-';
  const normalized = normalizePhone(phone);
  
  if (!normalized.startsWith('62')) return phone;

  const core = normalized.substring(2); // Get the 8xx part
  const parts = core.length <= 10
    ? [core.substring(0, 3), core.substring(3, 7), core.substring(7)]
    : [core.substring(0, 4), core.substring(4, 8), core.substring(8)];

  return '+62 ' + parts.filter(Boolean).join('-');
}
