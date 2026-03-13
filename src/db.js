/**
 * db.js — SQLite shareholder registry
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'shareholders.db');

const _dbs = {};

function getDb() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'shareholders.db');
  if (!_dbs[dbPath]) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    _dbs[dbPath] = new Database(dbPath);
    migrate(_dbs[dbPath]);
  }
  return _dbs[dbPath];
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      txid TEXT PRIMARY KEY,
      sender_address TEXT,
      amount_sats INTEGER NOT NULL,
      confirmed_at INTEGER,
      confirmed INTEGER NOT NULL DEFAULT 0,
      recorded_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS shareholders (
      address TEXT PRIMARY KEY,
      total_sats INTEGER NOT NULL DEFAULT 0,
      first_seen INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      last_seen INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      label TEXT
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO meta (key, value) VALUES ('last_sync', '0');
  `);
}

function recordTransaction(tx) {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO transactions (txid, sender_address, amount_sats, confirmed_at, confirmed)
    VALUES (@txid, @senderAddress, @amountSats, @confirmedAt, @confirmed)
  `);

  const upsertShareholder = db.prepare(`
    INSERT INTO shareholders (address, total_sats, first_seen, last_seen)
    VALUES (@address, @amountSats, strftime('%s','now'), strftime('%s','now'))
    ON CONFLICT(address) DO UPDATE SET
      total_sats = total_sats + @amountSats,
      last_seen = strftime('%s','now')
  `);

  const updateMeta = db.prepare(`UPDATE meta SET value = @value WHERE key = 'last_sync'`);

  const run = db.transaction((tx) => {
    const result = insert.run({
      ...tx,
      confirmed: tx.confirmed ? 1 : 0,
    });
    if (result.changes > 0 && tx.senderAddress) {
      upsertShareholder.run({ address: tx.senderAddress, amountSats: tx.amountSats });
    }
    updateMeta.run({ value: String(Date.now()) });
    return result.changes > 0;
  });

  return run(tx);
}

function getShareholders() {
  const db = getDb();
  const shareholders = db.prepare(`
    SELECT address, total_sats, first_seen, last_seen, label
    FROM shareholders
    ORDER BY total_sats DESC
  `).all();

  const totalSats = shareholders.reduce((sum, s) => sum + s.total_sats, 0);

  return shareholders.map(s => ({
    ...s,
    stake_pct: totalSats > 0 ? ((s.total_sats / totalSats) * 100).toFixed(2) : '0.00',
  }));
}

function getTransactions() {
  return getDb().prepare(`
    SELECT * FROM transactions ORDER BY recorded_at DESC
  `).all();
}

function isKnownTx(txid) {
  return !!getDb().prepare('SELECT 1 FROM transactions WHERE txid = ?').get(txid);
}

function setLabel(address, label) {
  getDb().prepare(`
    UPDATE shareholders SET label = ? WHERE address = ?
  `).run(label, address);
}

function getLastSync() {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = 'last_sync'").get();
  return parseInt(row?.value || '0');
}

module.exports = { getDb, recordTransaction, getShareholders, getTransactions, isKnownTx, setLabel, getLastSync };
