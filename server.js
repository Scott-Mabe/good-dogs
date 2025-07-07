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
    
    console.log(JSON.stringify({
      level: 'ERROR',
      message: 'Failed to get random dog',
      service: 'good-dogs',
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack
      },
      dd: {
        trace_id: span.context().toTraceId(),
        span_id: span.context().toSpanId()
      }
    }));
    
    res.status(500).json({ error: 'Failed to get random dog' });
  } finally {
    span.finish();
  }
});

app.post('/api/vote', (req, res) => {
  const { vote, timestamp } = req.body;
  const span = tracer.startSpan(`post.vote.${vote === 'good' ? 'good' : 'bad'}`);
  
  try {
    span.setTag('vote.type', vote);
    span.setTag('vote.timestamp', timestamp);
    span.setTag('vote.selection', vote === 'good' ? 'good_dog' : 'bad_dog');
    
    const logEntry = {
      level: 'INFO',
      message: 'Vote recorded',
      service: 'good-dogs',
      timestamp: new Date().toISOString(),
      vote: {
        type: vote,
        selection: vote === 'good' ? 'good_dog' : 'bad_dog',
        user_timestamp: timestamp
      },
      request: {
        ip: req.ip,
        user_agent: req.get('User-Agent'),
        method: req.method,
        url: req.url
      },
      dd: {
        trace_id: span.context().toTraceId(),
        span_id: span.context().toSpanId()
      }
    };
    
    const logPath = path.join(__dirname, 'votes.log');
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
    
    span.setTag('vote.logged', true);
    res.json({ success: true, message: 'Vote recorded' });
  } catch (error) {
    span.setTag('error', true);
    span.setTag('error.message', error.message);
    
    console.log(JSON.stringify({
      level: 'ERROR',
      message: 'Failed to record vote',
      service: 'good-dogs',
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack
      },
      dd: {
        trace_id: span.context().toTraceId(),
        span_id: span.context().toSpanId()
      }
    }));
    
    res.status(500).json({ error: 'Failed to record vote' });
  } finally {
    span.finish();
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Good Dogs server started successfully',
    service: 'good-dogs',
    port: PORT,
    timestamp: new Date().toISOString(),
    dd: {
      trace_id: tracer.scope().active()?.context()?.toTraceId(),
      span_id: tracer.scope().active()?.context()?.toSpanId()
    }
  }));
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Server ready for connections',
    service: 'good-dogs',
    url: `http://localhost:${PORT}`,
    timestamp: new Date().toISOString(),
    dd: {
      trace_id: tracer.scope().active()?.context()?.toTraceId(),
      span_id: tracer.scope().active()?.context()?.toSpanId()
    }
  }));
});