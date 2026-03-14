/**
 * api.js — REST API for shareholder data
 */

const express = require('express');
const { getShareholders, getTransactions, getLastSync } = require('./db');

const router = express.Router();

// GET /api/shareholders — full registry with stake percentages
router.get('/shareholders', (req, res) => {
  const shareholders = getShareholders();
  const totalSats = shareholders.reduce((sum, s) => sum + s.total_sats, 0);

  res.json({
    shareholders,
    total_sats: totalSats,
    count: shareholders.length,
    last_sync: getLastSync(),
    timestamp: new Date().toISOString(),
  });
});

// GET /api/shareholders/:address — single shareholder
router.get('/shareholders/:address', (req, res) => {
  const all = getShareholders();
  const sh = all.find(s => s.address === req.params.address);
  if (!sh) return res.status(404).json({ error: 'Address not found' });
  res.json(sh);
});

// GET /api/transactions — all recorded incoming txs
router.get('/transactions', (req, res) => {
  res.json(getTransactions());
});

// GET /api/health
router.get('/health', (req, res) => {
  res.json({ status: 'ok', last_sync: getLastSync(), timestamp: new Date().toISOString() });
});


// POST /api/webhook/mempool — mempool.space push notification
router.post('/webhook/mempool', async (req, res) => {
  try {
    const { handleMempoolEvent } = require('./webhook');
    const result = await handleMempoolEvent(req.body);
    res.json(result);
  } catch (err) {
    console.error('[webhook] Handler error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
