process.env.DB_PATH = '/tmp/test-webhook-shareholders.db';
process.env.WALLET_ADDRESS = '148G6STLQaei9NbFMVXmLahipfHQGWw4pW';

const fs = require('fs');
const OUR_ADDRESS = '148G6STLQaee9NbFMVXmLahipfHQGWw4pW';

// Reset modules so db.js gets a fresh singleton with our DB_PATH
jest.resetModules();

const { handleMempoolEvent } = require('../src/webhook');
const { isKnownTx, resetDb } = require('../src/db');

const SENDER_ADDRESS = 'bc1qsender_webhook_test';

jest.mock('../src/blockchain', () => ({
  ...jest.requireActual('../src/blockchain'),
  fetchTransaction: jest.fn(),
}));

const { fetchTransaction } = require('../src/blockchain');

function makeTx(txid, amountSats, senderAddress) {
  const WALLET = '148G6STLQaei9NbFMVXmLahipfHQGWw4pW';
  return {
    txid,
    vin: [{ prevout: { scriptpubkey_address: senderAddress, value: amountSats + 200 } }],
    vout: [
      { scriptpubkey_address: WALLET, value: amountSats },
      { scriptpubkey_address: senderAddress, value: 200 },
    ],
    status: { confirmed: true, block_time: 1700000000 },
  };
}

const WALLET = '148G6STLQaei9NbFMVXmLahipfHQGWw4pW';

beforeAll(() => {
  resetDb();
  if (fs.existsSync(process.env.DB_PATH)) fs.unlinkSync(process.env.DB_PATH);
});

describe('handleMempoolEvent', () => {
  test('ignores payload with no txid', async () => {
    const result = await handleMempoolEvent({});
    expect(result.ignored).toBe(true);
    expect(result.reason).toBe('no txid');
  });

  test('records a valid incoming transaction', async () => {
    fetchTransaction.mockResolvedValueOnce(makeTx('whtx001', 500, SENDER_ADDRESS));
    const result = await handleMempoolEvent({ txid: 'whtx001' });
    expect(result.recorded).toBe(true);
    expect(result.senderAddress).toBe(SENDER_ADDRESS);
    expect(result.amountSats).toBe(500);
    expect(isKnownTx('whtx001')).toBe(true);
  });

  test('ignores already known txid', async () => {
    // whtx001 was recorded in previous test
    const result = await handleMempoolEvent({ txid: 'whtx001' });
    expect(result.ignored).toBe(true);
    expect(result.reason).toBe('already known');
  });

  test('ignores non-incoming transactions', async () => {
    fetchTransaction.mockResolvedValueOnce({
      txid: 'whtx_noincoming',
      vin: [{ prevout: { scriptpubkey_address: WALLET } }],
      vout: [{ scriptpubkey_address: 'someOtherAddress', value: 1000 }],
      status: { confirmed: true, block_time: 1700000000 },
    });
    const result = await handleMempoolEvent({ txid: 'whtx_noincoming' });
    expect(result.ignored).toBe(true);
    expect(result.reason).toBe('not an incoming tx');
  });

  test('handles tx nested in payload.tx', async () => {
    fetchTransaction.mockResolvedValueOnce(makeTx('whtx003', 1000, 'bc1qsender_nested'));
    const result = await handleMempoolEvent({ tx: { txid: 'whtx003' } });
    expect(result.recorded).toBe(true);
    expect(result.amountSats).toBe(1000);
  });
});
