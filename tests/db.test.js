process.env.DB_PATH = '/tmp/test-shareholders.db';

const fs = require('fs');
const { recordTransaction, getShareholders, isKnownTx, setLabel, getTransactions, resetDb } = require('../src/db');

// Clean up before tests
beforeAll(() => {
  resetDb();
  if (fs.existsSync(process.env.DB_PATH)) fs.unlinkSync(process.env.DB_PATH);
});

const TX1 = {
  txid: 'txtest001',
  senderAddress: 'bc1qsender1',
  amountSats: 5000,
  confirmedAt: 1700000000,
  confirmed: true,
};

const TX2 = {
  txid: 'txtest002',
  senderAddress: 'bc1qsender2',
  amountSats: 3000,
  confirmedAt: 1700000100,
  confirmed: true,
};

const TX3 = {
  txid: 'txtest003',
  senderAddress: 'bc1qsender1', // same sender as TX1
  amountSats: 2000,
  confirmedAt: 1700000200,
  confirmed: true,
};

describe('recordTransaction', () => {
  test('records a new transaction and returns true', () => {
    const result = recordTransaction(TX1);
    expect(result).toBe(true);
  });

  test('ignores duplicate txid and returns false', () => {
    const result = recordTransaction(TX1);
    expect(result).toBe(false);
  });

  test('records second transaction', () => {
    expect(recordTransaction(TX2)).toBe(true);
  });

  test('accumulates sats for returning sender', () => {
    expect(recordTransaction(TX3)).toBe(true);
  });
});

describe('isKnownTx', () => {
  test('returns true for known txid', () => {
    expect(isKnownTx('txtest001')).toBe(true);
  });

  test('returns false for unknown txid', () => {
    expect(isKnownTx('unknown')).toBe(false);
  });
});

describe('getShareholders', () => {
  test('returns all shareholders sorted by total sats desc', () => {
    const shareholders = getShareholders();
    expect(shareholders.length).toBe(2);
    expect(shareholders[0].address).toBe('bc1qsender1');
    expect(shareholders[0].total_sats).toBe(7000); // 5000 + 2000
    expect(shareholders[1].address).toBe('bc1qsender2');
    expect(shareholders[1].total_sats).toBe(3000);
  });

  test('calculates stake percentages correctly', () => {
    const shareholders = getShareholders();
    const total = 10000;
    expect(shareholders[0].stake_pct).toBe('70.00');
    expect(shareholders[1].stake_pct).toBe('30.00');
  });
});

describe('setLabel', () => {
  test('sets a label on a shareholder', () => {
    setLabel('bc1qsender1', 'Founder');
    const shareholders = getShareholders();
    const sh = shareholders.find(s => s.address === 'bc1qsender1');
    expect(sh.label).toBe('Founder');
  });
});

describe('getTransactions', () => {
  test('returns all transactions', () => {
    const txs = getTransactions();
    expect(txs.length).toBe(3);
  });
});
