import Razorpay from "razorpay";
import crypto from "crypto";

// ============================================================
// Thin wrapper around the Razorpay Node SDK + HMAC signature verification.
// Reads RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET/RAZORPAY_WEBHOOK_SECRET inline
// via process.env, same ad-hoc pattern as config/spaces.ts's DO_SPACES_*
// reads — deliberately NOT added to config/env.ts's fail-fast
// REQUIRED_ENV_VARS, so the server still boots without real Razorpay
// credentials (this integration ships with placeholder test-mode keys
// until the user supplies real ones; every other module keeps working).
//
// Test Mode only — RAZORPAY_KEY_ID/KEY_SECRET must be a Razorpay TEST key
// pair (rzp_test_...), never live credentials, for this demo integration.
// ============================================================

let _client: Razorpay | null = null;

// Lazily constructed (not at module load) so importing this file never
// throws even with placeholder/missing env vars — the error only surfaces
// when a checkout is actually attempted, with a clear message instead of a
// crash at server boot.
const getClient = (): Razorpay => {
  if (_client) return _client;

  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error(
      "Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the environment."
    );
  }

  _client = new Razorpay({ key_id, key_secret });
  return _client;
};

export const getPublicKeyId = (): string => process.env.RAZORPAY_KEY_ID || "";

// amountInRupees is converted to paise (Razorpay's smallest-unit
// convention) here, once, so every caller works in rupees.
export const createOrder = async (amountInRupees: number, currency: string, receipt: string) => {
  const client = getClient();
  return client.orders.create({
    amount: Math.round(amountInRupees * 100),
    currency,
    receipt,
  });
};

// Razorpay's documented checkout-success verification: HMAC-SHA256 of
// "<order_id>|<payment_id>" using the account's key secret, compared to the
// signature the frontend received from Checkout.js. Never trust a
// frontend "payment succeeded" flag on its own — this is the actual proof.
export const verifyPaymentSignature = (params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean => {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return false;

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest("hex");

  return expected === params.razorpaySignature;
};

// Webhook signature verification — HMAC-SHA256 of the exact raw request
// body bytes (rawBodyBuffer, captured by server.ts's express.json({verify})
// callback) using RAZORPAY_WEBHOOK_SECRET, compared to the
// X-Razorpay-Signature header. Verifying against the raw bytes (not
// req.body re-serialized) matters — JSON.stringify(req.body) is not
// guaranteed byte-identical to what Razorpay actually signed.
export const verifyWebhookSignature = (rawBodyBuffer: Buffer, signatureHeader: string | undefined): boolean => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret || !signatureHeader) return false;

  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBodyBuffer).digest("hex");
  return expected === signatureHeader;
};
