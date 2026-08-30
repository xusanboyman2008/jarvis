---
name: javascript-dev
description: >-
  Provides modern JavaScript/TypeScript and Node.js development patterns, asynchronous runtime management,
  DOM manipulation, networking, and bundler configurations.
---

# JavaScript & Node.js Engineering Skill

Dense reference for modern ESNext, TypeScript, Node.js system interaction, streams, and browser DOM engineering.

---

## 1. Node.js Streaming & Pipeline Pattern
Process data chunk-by-chunk to keep memory footprint minimal.

```javascript
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';

async function compressFile(inputPath, outputPath) {
  await pipeline(
    createReadStream(inputPath),
    createGzip(),
    createWriteStream(outputPath)
  );
}
```

---

## 2. Robust Async Pool / Concurrency Limiter
Limit concurrent asynchronous promises in vanilla JavaScript without third-party dependencies.

```javascript
async function asyncPool(limit, array, iteratorFn) {
  const ret = [];
  const executing = new Set();

  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);
    executing.add(p);

    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(ret);
}
```

---

## 3. High-Performance WebSocket Client with Auto-Reconnect

```javascript
class ResilientWebSocket {
  constructor(url, protocols = []) {
    this.url = url;
    this.protocols = protocols;
    this.reconnectInterval = 2000;
    this.ws = null;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url, this.protocols);

    this.ws.onopen = () => console.log('Connected to', this.url);
    this.ws.onmessage = (event) => this.onMessage(event.data);
    this.ws.onclose = () => {
      console.warn('Connection lost. Retrying in', this.reconnectInterval);
      setTimeout(() => this.connect(), this.reconnectInterval);
    };
    this.ws.onerror = (err) => console.error('WebSocket Error:', err);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }

  onMessage(data) {
    // Custom message handler
    console.log('Received:', data);
  }
}
```

---

## 4. DOM Observers: Intersection & Mutation
Efficiently detect elements entering the viewport and DOM changes without scroll polling.

```javascript
// Infinite scroll trigger via IntersectionObserver
const sentinel = document.querySelector('#sentinel');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      loadNextPage();
    }
  });
}, { rootMargin: '200px' });

if (sentinel) observer.observe(sentinel);
```
