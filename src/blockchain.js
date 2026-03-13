/**
 * blockchain.js — Blockstream API client
 * Fetches transactions for a Bitcoin address
 */

const BLOCKSTREAM_API = 'https://blockstream.info/api';

async function fetchTransactions(address) {
  const res = await fetch(`${BLOCKSTREAM_API}/address/${address}/txs`);
  if (!res.ok) throw new Error(`Blockstream API error: ${res.status}`);
  return res.json();
}

async function fetchTransaction(txid) {
  const res = await fetch(`${BLOCKSTREAM_API}/tx/${txid}`);
  if (!res.ok) throw new Error(`Blockstream API error: ${res.status}`);
  return res.json();
}

/**
 * Extract incoming sats and sender address from a tx
 * Returns { senderAddress, amountSats, txid, confirmedAt } or null if not incoming
 */
function parseIncomingTx(tx, ourAddress) {
  // Check if any output goes to our address
  const incomingOutputs = tx.vout.filter(
    o => o.scriptpubkey_address === ourAddress
  );
  if (incomingOutputs.length === 0) return null;

  // Skip self-transfers (all inputs also from our address)
  const isSelfTransfer = tx.vin.every(
    i => i.prevout?.scriptpubkey_address === ourAddress
  );
  if (isSelfTransfer) return null;

  const amountSats = incomingOutputs.reduce((sum, o) => sum + o.value, 0);

  // Get sender: first input not from our address
  const senderInput = tx.vin.find(
    i => i.prevout?.scriptpubkey_address !== ourAddress
  );
  const senderAddress = senderInput?.prevout?.scriptpubkey_address || null;

  return {
    txid: tx.txid,
    senderAddress,
    amountSats,
    confirmedAt: tx.status?.block_time || null,
    confirmed: tx.status?.confirmed || false,
  };
}

module.exports = { fetchTransactions, fetchTransaction, parseIncomingTx };
