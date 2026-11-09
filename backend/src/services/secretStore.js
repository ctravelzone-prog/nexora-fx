// services/secretStore.js — encrypt/decrypt admin-entered secrets (v123).
// Used for the Binance API keys the admin pastes in the Auto Payments
// panel, so Siam never has to edit the VPS .env by hand.
//
// Security: AES-256-GCM. The encryption key is derived from JWT_SECRET
// (server .env only — never in code, chat, the DB or an API response),
// so the ciphertext in site_settings is useless without the server's
// own .env. Stored format: base64(iv 12B || authTag 16B || ciphertext).
// The UI only ever sees "set" + the last 4 chars of a KEY (never a
// secret, never the full value). If JWT_SECRET ever changes, stored
// keys become undecryptable and the admin simply re-enters them.
const crypto = require('node:crypto');

function encKey() {
  const s = process.env.JWT_SECRET || 'nexora-fallback';
  return crypto.createHash('sha256').update(String(s)).digest();
}

function encryptSecret(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const ct = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

function decryptSecret(enc) {
  if (!enc) return '';
  try {
    const buf = Buffer.from(String(enc), 'base64');
    if (buf.length < 29) return '';
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch (_) {
    return '';
  }
}

// Last 4 chars of a key for the masked display (e.g. "••••abcd").
// Returns '' when nothing is stored.
function maskKey(key) {
  const k = String(key || '');
  if (!k) return '';
  return '••••' + k.slice(-4);
}

module.exports = { encryptSecret, decryptSecret, maskKey };
