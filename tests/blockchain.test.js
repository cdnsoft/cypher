const { parseIncomingTx } = require('../src/blockchain');

const OUR_ADDRESS = '148G6STLQaei9NbFMVXmLahipfHQGWw4pW';
const SENDER_ADDRESS = 'bc1qw3d35yp7njp670nrehrpsq49yq0350m2k30gem';

// Helpers
function makeTx({ vout = [], vin = [], txid = 'abc123', confirmed = true, block_time = 1700000000 } = {}) {
  return { txid, vin, vout, status: { confirmed, block_time } };
}

describe('parseIncomingTx', () => {
  test('returns null when no outputs go to our address', () => {
    const tx = makeTx({
      vout: [{ scriptpubkey_address: 'someOtherAddress', value: 1000 }],
      vin: [{ prevout: { scriptpubkey_address: SENDER_ADDRESS } }],
    });
    expect(parseIncomingTx(tx, OUR_ADDRESS)).toBeNull();
  });

  test('returns null for self-transfers (all inputs from our address)', () => {
    const tx = makeTx({
      vout: [{ scriptpubkey_address: OUR_ADDRESS, value: 5000 }],
      vin: [{ prevout: { scriptpubkey_address: OUR_ADDRESS } }],
    });
    expect(parseIncomingTx(tx, OUR_ADDRESS)).toBeNull();
  });

  test('correctly parses an incoming transaction', () => {
    const tx = makeTx({
      txid: 'tx001',
      vout: [
        { scriptpubkey_address: OUR_ADDRESS, value: 6910 },
        { scriptpubkey_address: SENDER_ADDRESS, value: 200 }, // change
      ],
      vin: [{ prevout: { scriptpubkey_address: SENDER_ADDRESS, value: 7134 } }],
    });

    const result = parseIncomingTx(tx, OUR_ADDRESS);
    expect(result).not.toBeNull();
    expect(result.txid).toBe('tx001');
    expect(result.senderAddress).toBe(SENDER_ADDRESS);
    expect(result.amountSats).toBe(6910);
    expect(result.confirmed).toBe(true);
    expect(result.confirmedAt).toBe(1700000000);
  });

  test('sums multiple outputs to our address', () => {
    const tx = makeTx({
      vout: [
        { scriptpubkey_address: OUR_ADDRESS, value: 1000 },
        { scriptpubkey_address: OUR_ADDRESS, value: 500 },
      ],
      vin: [{ prevout: { scriptpubkey_address: SENDER_ADDRESS } }],
    });

    const result = parseIncomingTx(tx, OUR_ADDRESS);
    expect(result.amountSats).toBe(1500);
  });

  test('handles unconfirmed transactions', () => {
    const tx = makeTx({
      vout: [{ scriptpubkey_address: OUR_ADDRESS, value: 300 }],
      vin: [{ prevout: { scriptpubkey_address: SENDER_ADDRESS } }],
      confirmed: false,
      block_time: null,
    });

    const result = parseIncomingTx(tx, OUR_ADDRESS);
    expect(result.confirmed).toBe(false);
    expect(result.confirmedAt).toBeNull();
  });

  test('handles missing sender address gracefully', () => {
    const tx = makeTx({
      vout: [{ scriptpubkey_address: OUR_ADDRESS, value: 1000 }],
      vin: [{ prevout: null }],
    });

    const result = parseIncomingTx(tx, OUR_ADDRESS);
    expect(result).not.toBeNull();
    expect(result.senderAddress).toBeNull();
    expect(result.amountSats).toBe(1000);
  });
});
