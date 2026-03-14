require('dotenv').config();
const http = require('http');
const express = require('express');
const api = require('./src/api');
const { startPolling } = require('./src/detector');
const { registerWebhook } = require('./src/webhook');
const { initWebSocket } = require('./src/ws');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use('/api', api);

app.get('/', (req, res) => {
  res.json({ service: 'cypher-shareholders', version: '1.1.0' });
});

const PORT = process.env.PORT || 3211;
const server = http.createServer(app);

// Attach WebSocket server to the same HTTP server
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`Shareholders service running on port ${PORT}`);
  startPolling();
  registerWebhook().catch(console.error);
});
