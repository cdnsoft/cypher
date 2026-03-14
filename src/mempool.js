/**
 * mempool.js — Single persistent WebSocket client to mempool.space
 * Subscribes to address updates, stores new txs, broadcasts to browser clients
 */

const { WebSocket } = require('ws');
const { fetchTransaction, parseIncomingTx } = require('./blockchain');
const { recordTransaction, isKnownTx, getShareholders } = require('./db');
const { broadcast } = require('./ws');

const WALLET_ADDRESS = process.env.WALLET_ADDRESS || '148G6STLQaei9NbFMVXmLahipfHQGWw4pW';
const MEMPOOL_WS_URL = 'wss://mempool.space/api/v1/ws';

let ws = null;
let pingInterval = null;

function connect() {
  console.log('[mempool] Connecting to mempool.space WS...');
  ws = new WebSocket(MEMPOOL_WS_URL);

  ws.on('open', () => {
    console.log('[mempool] Connected. Subscribing to address:', WALLET_ADDRESS);

    // Subscribe to address tx updates
    ws.send(JSON.stringify({ 'track-address': WALLET_ADDRESS }));

    // Send ping every 30s to keep connection alive
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'ping' }));
      }
    }, 30000);
  });

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);

      // Address tx events come as 'address-transactions' (confirmed) 
      // or inside the address tracking response
      // address-transactions = new mempool txs, block-transactions = newly confirmed
      const txList = [...(msg['address-transactions'] || []), ...(msg['block-transactions'] || [])];

      for (const tx of txList) {
        const txid = tx.txid || tx;
        if (!txid || isKnownTx(txid)) continue;

        // Fetch full tx details from blockstream
        const fullTx = await fetchTransaction(txid);
        const parsed = parseIncomingTx(fullTx, WALLET_ADDRESS);
        if (!parsed) continue;

        const isNew = recordTransaction(parsed);
        if (isNew) {
          console.log(`[mempool] 🎉 New shareholder! ${parsed.senderAddress} — ${parsed.amountSats} sats`);
          broadcast(getShareholders());
        }
      }
    } catch (err) {
      console.warn('[mempool] Message error:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('[mempool] Disconnected. Reconnecting in 5s...');
    clearInterval(pingInterval);
    setTimeout(connect, 5000);
  });

  ws.on('error', (err) => {
    console.warn('[mempool] Error:', err.message);
    // close triggers reconnect
  });
}

function startMempoolClient() {
  connect();
}

module.exports = { startMempoolClient };
