const tracer = require('dd-trace').init({
  service: 'good-dogs',
  env: 'doggos',
  version: '1.5.0',
  profiling: true,
  runtimeMetrics: true,
  logInjection: true
});

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const dogImages = [
  'dog1.jpg',
  'dog2.jpg',
  'dog3.jpg',
  'dog4.jpg',
  'dog5.jpg',
  'dog6.jpg',
  'dog7.jpg',
  'dog8.jpg',
  'dog9.jpg',
  'dog10.jpg'
];

app.get('/api/random-dog', (req, res) => {
  const span = tracer.startSpan('get.random-dog');
  
  try {
    const randomImage = dogImages[Math.floor(Math.random() * dogImages.length)];
    const imagePath = `/images/${randomImage}`;
    span.setTag('dog.image.url', imagePath);
    res.redirect(imagePath);
  } catch (error) {
    span.setTag('error', true);
    span.setTag('error.message', error.message);
    res.status(500).json({ error: 'Failed to get random dog' });
  } finally {
    span.finish();
  }
});

app.post('/api/vote', (req, res) => {
  const span = tracer.startSpan('post.vote');
  
  try {
    const { vote, timestamp } = req.body;
    
    span.setTag('vote.type', vote);
    span.setTag('vote.timestamp', timestamp);
    
    const logEntry = {
      vote,
      timestamp,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    const logPath = path.join(__dirname, 'votes.log');
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
    
    span.setTag('vote.logged', true);
    res.json({ success: true, message: 'Vote recorded' });
  } catch (error) {
    span.setTag('error', true);
    span.setTag('error.message', error.message);
    res.status(500).json({ error: 'Failed to record vote' });
  } finally {
    span.finish();
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Good Dogs server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to start voting on dogs!`);
});