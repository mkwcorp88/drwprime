export const OPS_PASSWORD_MIN_LENGTH = 10;
export const OPS_PASSWORD_MAX_LENGTH = 128;

export function normalizeOpsEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateOpsEmail(value: string): string | null {
  const email = normalizeOpsEmail(value);
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Format email tidak valid.';
  }
  return null;
}

export function validateOpsPassword(value: string): string | null {
  if (value.length < OPS_PASSWORD_MIN_LENGTH) {
    return `Password minimal ${OPS_PASSWORD_MIN_LENGTH} karakter.`;
  }
  if (value.length > OPS_PASSWORD_MAX_LENGTH) {
    return `Password maksimal ${OPS_PASSWORD_MAX_LENGTH} karakter.`;
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    return 'Password harus memiliki huruf besar, huruf kecil, angka, dan simbol.';
  }
  return null;
}
