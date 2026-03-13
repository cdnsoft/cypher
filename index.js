require('dotenv').config();
const express = require('express');
const api = require('./src/api');
const { startPolling } = require('./src/detector');

const app = express();
app.use(express.json());

// CORS — shareholders page on cypher.cdnsoft.net needs this
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use('/api', api);

app.get('/', (req, res) => {
  res.json({ service: 'cypher-shareholders', version: '1.0.0' });
});

const PORT = process.env.PORT || 3211;
app.listen(PORT, () => {
  console.log(`Shareholders service running on port ${PORT}`);
  startPolling();
});
