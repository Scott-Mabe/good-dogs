const tracer = require('dd-trace').init({
  service: 'good-dogs',
  env: 'doggos'
});

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const dogImages = [
  'https://images.dog.ceo/breeds/golden-retriever/20200705-130717.jpg',
  'https://images.dog.ceo/breeds/labrador/n02099712_8932.jpg',
  'https://images.dog.ceo/breeds/husky/n02110185_5821.jpg',
  'https://images.dog.ceo/breeds/beagle/n02088364_17206.jpg',
  'https://images.dog.ceo/breeds/corgi-cardigan/n02113186_8119.jpg',
  'https://images.dog.ceo/breeds/poodle-standard/n02113799_5049.jpg',
  'https://images.dog.ceo/breeds/bulldog-french/n02108915_7613.jpg',
  'https://images.dog.ceo/breeds/shepherd-german/n02106662_26664.jpg',
  'https://images.dog.ceo/breeds/retriever-chesapeake/n02099849_2621.jpg',
  'https://images.dog.ceo/breeds/spaniel-cocker/n02102318_4150.jpg'
];

app.get('/api/random-dog', (req, res) => {
  const span = tracer.startSpan('get.random-dog');
  
  try {
    const randomImage = dogImages[Math.floor(Math.random() * dogImages.length)];
    span.setTag('dog.image.url', randomImage);
    res.redirect(randomImage);
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