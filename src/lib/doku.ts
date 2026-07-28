/**
 * DOKU Payment Gateway Integration - DRW Prime Sandbox
 *
 * Uses DOKU Checkout API (JOKUL) for product checkout.
 * Docs: https://jokul.doku.com/docs
 *
 * Flow:
 * 1. Create payment via POST /checkout/v1/payment
 * 2. Customer redirected to DOKU payment page
 * 3. DOKU sends notification to our webhook
 * 4. We verify & update order status
 */

import crypto from 'crypto';

// ============================================
// Configuration
// ============================================

const DOKU_IS_PRODUCTION = process.env.DOKU_IS_PRODUCTION === 'true';
const DOKU_BASE_URL = DOKU_IS_PRODUCTION
  ? 'https://api.doku.com'
  : 'https://api-sandbox.doku.com';

const CLIENT_ID = process.env.DOKU_CLIENT_ID || '';
const SECRET_KEY = process.env.DOKU_SECRET_KEY || '';

// ============================================
// Utility Functions
// ============================================

export function generateInvoiceNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-DRWP-${dateStr}-${random}`;
}

/**
 * Generate HMAC-SHA256 signature for DOKU API requests
 */
function generateSignature(
  clientId: string,
  requestId: string,
  requestTimestamp: string,
  requestTarget: string,
  digest: string,
  secretKey: string,
): string {
  const componentSignature = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${requestTimestamp}\nRequest-Target:${requestTarget}\nDigest:${digest}`;
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(componentSignature);
  return `HMACSHA256=${hmac.digest('base64')}`;
}

function generateDigest(body: string): string {
  return crypto.createHash('sha256').update(body, 'utf8').digest('base64');
}

function generateRequestId(): string {
  return crypto.randomUUID();
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function sanitizePhoneForDoku(phone: string): string {
  if (!phone) return '000000000000';
  let cleaned = phone.replace(/^\+/, '').replace(/[\s\-\(\)\.]/g, '').trim();
  if (/^62\d+$/.test(cleaned)) cleaned = '0' + cleaned.slice(2);
  cleaned = cleaned.replace(/\D/g, '');
  return cleaned && cleaned.length >= 6 ? cleaned : '000000000000';
}

// ============================================
// DOKU Checkout API
// ============================================

export interface DokuCheckoutItem {
  name: string;
  price: number;
  quantity: number;
}

export interface DokuCheckoutParams {
  invoiceNumber: string;
  amount: number;
  items: DokuCheckoutItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notificationUrl: string;
  returnUrl: string;
  expiryDuration?: number;
}

export interface DokuCheckoutResponse {
  message: string[];
  response: {
    order: { invoice_number: string; amount: number };
    payment: { url: string; token_id: string };
    uuid: string;
  };
}

export async function createCheckoutPayment(params: DokuCheckoutParams): Promise<DokuCheckoutResponse> {
  const requestTarget = '/checkout/v1/payment';
  const requestId = generateRequestId();
  const requestTimestamp = getTimestamp();
  const amount = Math.round(params.amount);

  const lineItems = params.items.map((item, idx) => ({
    id: String(idx + 1),
    name: item.name.substring(0, 50),
    price: Math.round(item.price),
    quantity: item.quantity,
  }));

  const lineItemsTotal = lineItems.reduce((sum, li) => sum + li.price * li.quantity, 0);
  let finalLineItems: typeof lineItems | undefined = lineItems;
  if (lineItemsTotal !== amount) {
    console.log('[DOKU] Line items total mismatch, omitting line_items');
    finalLineItems = undefined;
  }

  const requestBody: Record<string, unknown> = {
    order: {
      amount,
      invoice_number: params.invoiceNumber,
      currency: 'IDR',
      callback_url: params.returnUrl,
      callback_url_cancel: params.returnUrl,
      auto_redirect: true,
      ...(finalLineItems ? { line_items: finalLineItems } : {}),
    },
    payment: { payment_due_date: params.expiryDuration || 60 },
    customer: {
      id: params.customerEmail,
      name: params.customerName,
      email: params.customerEmail,
      phone: sanitizePhoneForDoku(params.customerPhone),
      country: 'ID',
    },
    additional_info: {
      override_notification_url: params.notificationUrl,
    },
  };

  const bodyString = JSON.stringify(requestBody);
  const digest = generateDigest(bodyString);
  const signature = generateSignature(CLIENT_ID, requestId, requestTimestamp, requestTarget, digest, SECRET_KEY);

  console.log('[DOKU] Creating payment:', {
    url: `${DOKU_BASE_URL}${requestTarget}`,
    invoiceNumber: params.invoiceNumber,
    amount,
    sandbox: !DOKU_IS_PRODUCTION,
  });

  const response = await fetch(`${DOKU_BASE_URL}${requestTarget}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': CLIENT_ID,
      'Request-Id': requestId,
      'Request-Timestamp': requestTimestamp,
      'Signature': signature,
    },
    body: bodyString,
  });

  const responseText = await response.text();

  let responseData: DokuCheckoutResponse;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    throw new Error(`DOKU API returned non-JSON response: ${response.status} - ${responseText.substring(0, 500)}`);
  }

  if (!response.ok) {
    console.error('[DOKU] Checkout creation failed:', responseData);
    throw new Error(`DOKU API error: ${response.status} - ${JSON.stringify(responseData)}`);
  }

  console.log('[DOKU] Checkout created:', {
    invoiceNumber: params.invoiceNumber,
    paymentUrl: responseData?.response?.payment?.url,
  });

  return responseData;
}

// ============================================
// Notification Verification
// ============================================

export function verifyNotificationSignature(
  clientId: string,
  requestId: string,
  requestTimestamp: string,
  requestTarget: string,
  body: string,
  receivedSignature: string,
): boolean {
  const digest = generateDigest(body);
  const expectedSignature = generateSignature(clientId, requestId, requestTimestamp, requestTarget, digest, SECRET_KEY);
  return expectedSignature === receivedSignature;
}

export function mapDokuStatus(transactionStatus: string): {
  paymentStatus: string;
  orderStatus: string;
} {
  switch (transactionStatus?.toUpperCase()) {
    case 'SUCCESS': return { paymentStatus: 'paid', orderStatus: 'processing' };
    case 'PENDING': return { paymentStatus: 'pending', orderStatus: 'pending' };
    case 'FAILED': return { paymentStatus: 'failed', orderStatus: 'cancelled' };
    case 'EXPIRED': return { paymentStatus: 'expired', orderStatus: 'cancelled' };
    case 'REFUNDED': return { paymentStatus: 'refunded', orderStatus: 'refunded' };
    case 'VOIDED': return { paymentStatus: 'cancelled', orderStatus: 'cancelled' };
    default: return { paymentStatus: 'pending', orderStatus: 'pending' };
  }
}
