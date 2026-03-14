/**
 * webhook.js — mempool.space WebSocket subscription for real-time tx detection
 */

const { WebSocket } = require('ws');
const { fetchTransaction, parseIncomingTx } = require('./blockchain');
const { recordTransaction, isKnownTx, getShareholders } = require('./db');
const { broadcast } = require('./ws');

const WALLET_ADDRESS = process.env.WALLET_ADDRESS || '148G6STLQaei9NbFMVXmLahipfHQGWw4pW';
const MEMPOOL_WS = 'wss://mempool.space/api/v1/ws';

let mempoolWs = null;

function connectMempool() {
  console.log('[mempool-ws] Connecting...');
  mempoolWs = new WebSocket(MEMPOOL_WS);

  mempoolWs.on('open', () => {
    console.log('[mempool-ws] Connected. Subscribing to address:', WALLET_ADDRESS);
    mempoolWs.send(JSON.stringify({
      action: 'want',
      data: ['blocks'],
    }));
    mempoolWs.send(JSON.stringify({
      'track-address': WALLET_ADDRESS,
    }));
  });

  mempoolWs.on('message', async (raw) => {
    try {
      const data = JSON.parse(raw);

      // Address tx event: { 'address-transactions': [...] } or { 'mempool-transactions': [...] }
      const txList = data['address-transactions'] || data['mempool-transactions'] || [];
      for (const tx of txList) {
        await handleTx(tx.txid || tx);
      }
    } catch (err) {
      console.warn('[mempool-ws] Parse error:', err.message);
    }
  });

  mempoolWs.on('close', () => {
    console.log('[mempool-ws] Disconnected. Reconnecting in 5s...');
    setTimeout(connectMempool, 5000);
  });

  mempoolWs.on('error', (err) => {
    console.warn('[mempool-ws] Error:', err.message);
    mempoolWs.close();
  });
}

async function handleTx(txid) {
  if (!txid || isKnownTx(txid)) return;

  try {
    const tx = await fetchTransaction(txid);
    const parsed = parseIncomingTx(tx, WALLET_ADDRESS);
    if (!parsed) return;

    const isNew = recordTransaction(parsed);
    if (isNew) {
      console.log(`[mempool-ws] New shareholder! ${parsed.senderAddress} — ${parsed.amountSats} sats`);
      broadcast(getShareholders());
    }
  } catch (err) {
    console.warn(`[mempool-ws] Error handling tx ${txid}:`, err.message);
  }
}

// Keep the HTTP webhook endpoint for manual triggering / testing
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

function registerWebhook() {
  connectMempool();
  return Promise.resolve();
}

module.exports = { registerWebhook, handleMempoolEvent };
