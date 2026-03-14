/**
 * webhook.js — mempool.space webhook integration
 * Registers address watcher and handles push notifications
 */

const { fetchTransaction, parseIncomingTx } = require('./blockchain');
const { recordTransaction, isKnownTx } = require('./db');

const WALLET_ADDRESS = process.env.WALLET_ADDRESS || '148G6STLQaei9NbFMVXmLahipfHQGWw4pW';
const PUBLIC_URL = process.env.PUBLIC_URL || '';

async function registerWebhook() {
  if (!PUBLIC_URL) {
    console.log('[webhook] PUBLIC_URL not set — skipping webhook registration');
    return;
  }

  const callbackUrl = `${PUBLIC_URL}/api/webhook/mempool`;

  try {
    const res = await fetch('https://mempool.space/api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'address',
        url: callbackUrl,
        address: WALLET_ADDRESS,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`[webhook] Registered with mempool.space — id: ${data.id}`);
    } else {
      const text = await res.text();
      console.warn(`[webhook] Registration failed: ${res.status} ${text}`);
    }
  } catch (err) {
    console.warn(`[webhook] Registration error: ${err.message}`);
  }
}

async function handleMempoolEvent(payload) {
  // mempool.space sends { txid, ... } or { tx: { txid, ... } }
  const txid = payload.txid || payload.tx?.txid;
  if (!txid) {
    console.warn('[webhook] Received event with no txid:', JSON.stringify(payload).slice(0, 100));
    return { ignored: true, reason: 'no txid' };
  }

  if (isKnownTx(txid)) {
    return { ignored: true, reason: 'already known' };
  }

  // Fetch full tx from blockstream
  const tx = await fetchTransaction(txid);
  const parsed = parseIncomingTx(tx, WALLET_ADDRESS);

  if (!parsed) {
    return { ignored: true, reason: 'not an incoming tx' };
  }

  const isNew = recordTransaction(parsed);
  if (isNew) {
    console.log(`[webhook] New shareholder detected! ${parsed.senderAddress} — ${parsed.amountSats} sats (tx: ${txid})`);
    return { recorded: true, senderAddress: parsed.senderAddress, amountSats: parsed.amountSats };
  }

  return { ignored: true, reason: 'duplicate' };
}

module.exports = { registerWebhook, handleMempoolEvent };
