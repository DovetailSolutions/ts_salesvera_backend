import crypto from "crypto";

// ============================================================
// AES-256-GCM encrypt/decrypt for employee_bank_accounts.
// bankAccountNumberEncrypted. This is the only place in the codebase that
// encrypts data at rest (the existing CompanyBank/company_banks feature
// stores its account number as plain text) — deliberately scoped to just
// this new per-employee table rather than retrofitted onto the older one.
//
// Key comes from process.env.BANK_ACCOUNT_ENC_KEY: a 32-byte key, base64
// encoded (44 chars). Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// Read lazily (not at module load) so a server without this feature
// configured yet can still boot — the error only surfaces if a bank-account
// endpoint is actually hit.
// ============================================================

const ALGORITHM = "aes-256-gcm";

const getKey = (): Buffer => {
  const raw = process.env.BANK_ACCOUNT_ENC_KEY;
  if (!raw) {
    throw new Error(
      "BANK_ACCOUNT_ENC_KEY is not configured — cannot encrypt/decrypt bank account numbers. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("BANK_ACCOUNT_ENC_KEY must decode to exactly 32 bytes (base64-encoded).");
  }
  return key;
};

// Returns "iv.authTag.ciphertext" — each segment base64, dot-separated.
export const encryptBankAccountNumber = (plainAccountNumber: string): string => {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainAccountNumber, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
};

export const decryptBankAccountNumber = (encrypted: string): string => {
  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted bank account number.");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
};

export const last4 = (accountNumber: string): string => accountNumber.replace(/\s+/g, "").slice(-4);
