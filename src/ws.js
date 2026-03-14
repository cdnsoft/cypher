/**
 * ws.js — WebSocket server for real-time shareholder updates
 */

const { WebSocketServer } = require('ws');
const { getShareholders } = require('./db');

let wss = null;

function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('[ws] Client connected');

    // Send current state immediately on connect
    ws.send(JSON.stringify({
      type: 'shareholders',
      data: getShareholders(),
    }));

    ws.on('close', () => console.log('[ws] Client disconnected'));
    ws.on('error', (err) => console.warn('[ws] Error:', err.message));
  });

  console.log('[ws] WebSocket server ready at /ws');
}

function broadcast(shareholders) {
  if (!wss) return;
  const msg = JSON.stringify({ type: 'shareholders', data: shareholders });
  let count = 0;
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(msg);
      count++;
    }
  });
  if (count > 0) console.log(`[ws] Broadcast to ${count} client(s)`);
}

module.exports = { initWebSocket, broadcast };
