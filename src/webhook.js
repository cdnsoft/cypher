/**
 * webhook.js — HTTP webhook endpoint for incoming tx notifications
 * Detection is handled by detector.js (blockstream polling every 30s)
 */

const { fetchTransaction, parseIncomingTx } = require('./blockchain');
const { recordTransaction, isKnownTx, getShareholders } = require('./db');
const { broadcast } = require('./ws');

const WALLET_ADDRESS = process.env.WALLET_ADDRESS || '148G6STLQaei9NbFMVXmLahipfHQGWw4pW';

// HTTP webhook handler — can be called by any external service (mempool.space, etc.)
async function handleMempoolEvent(payload) {
  const txid = payload.txid || payload.tx?.txid;
  if (!txid) return { ignored: true, reason: 'no txid' };
  if (isKnownTx(txid)) return { ignored: true, reason: 'already known' };

  const tx = await fetchTransaction(txid);
  const parsed = parseIncomingTx(tx, WALLET_ADDRESS);
  if (!parsed) return { ignored: true, reason: 'not an incoming tx' };

  const isNew = recordTransaction(parsed);
  if (isNew) {
    broadcast(getShareholders());
    return { recorded: true, senderAddress: parsed.senderAddress, amountSats: parsed.amountSats };
  }
  return { ignored: true, reason: 'duplicate' };
}

module.exports = { handleMempoolEvent };
