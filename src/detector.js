/**
 * detector.js — Polls blockchain for new incoming txs, updates shareholder registry
 */

const { fetchTransactions, parseIncomingTx } = require('./blockchain');
const { recordTransaction, isKnownTx } = require('./db');

const WALLET_ADDRESS = process.env.WALLET_ADDRESS || '148G6STLQaei9NbFMVXmLahipfHQGWw4pW';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '300000'); // 5 min default

async function sync() {
  console.log(`[detector] Syncing transactions for ${WALLET_ADDRESS}...`);
  const txs = await fetchTransactions(WALLET_ADDRESS);

  let newCount = 0;
  for (const tx of txs) {
    if (isKnownTx(tx.txid)) continue;

    const parsed = parseIncomingTx(tx, WALLET_ADDRESS);
    if (!parsed) continue;

    const isNew = recordTransaction(parsed);
    if (isNew) {
      newCount++;
      console.log(`[detector] New shareholder tx: ${parsed.txid} | ${parsed.senderAddress} | ${parsed.amountSats} sats`);
    }
  }

  console.log(`[detector] Sync complete. ${newCount} new transaction(s).`);
  return newCount;
}

function startPolling() {
  sync().catch(console.error);
  return setInterval(() => sync().catch(console.error), POLL_INTERVAL_MS);
}

module.exports = { sync, startPolling };
