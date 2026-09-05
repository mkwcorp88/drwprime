export function isOpsWhatsAppOtpEnabled(): boolean {
  const configured = process.env.OPS_WHATSAPP_OTP_ENABLED ?? process.env.WHATSAPP_OTP_ENABLED;
  return configured?.trim().toLowerCase() === 'true';
}

export function requiresOpsPasswordChange(staff: { mustChangePassword: boolean }): boolean {
  return !isOpsWhatsAppOtpEnabled() && staff.mustChangePassword;
}
