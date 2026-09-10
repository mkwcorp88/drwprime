export function isOpsWhatsAppOtpEnabled(): boolean {
  const configured = process.env.OPS_WHATSAPP_OTP_ENABLED ?? process.env.WHATSAPP_OTP_ENABLED;
  return configured?.trim().toLowerCase() === 'true';
}

export function isOpsLoginDisabled(): boolean {
  return process.env.OPS_LOGIN_DISABLED?.trim().toLowerCase() === 'true';
}

export function requiresOpsPasswordChange(staff: { mustChangePassword: boolean }): boolean {
  return !isOpsWhatsAppOtpEnabled() && staff.mustChangePassword;
}
