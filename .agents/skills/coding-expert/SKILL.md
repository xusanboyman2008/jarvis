---
name: coding-expert
description: >-
  Provides low-level system design, algorithm implementation, multi-language architecture,
  profiling, test-driven development, and refactoring guidelines.
---

# Coding Expert Skill

Comprehensive guidelines, design patterns, and engineering workflows for multi-language development.

## Core Engineering Principles

### 1. Robust Resource Management (RAII & Contexts)
Always tie lifecycles of external resources (file descriptors, sockets, database handles, camera feeds) to deterministic context managers.

```python
# Python Context Manager Pattern
from contextlib import contextmanager

@contextmanager
def managed_resource(*args, **kwargs):
    resource = acquire(*args, **kwargs)
    try:
        yield resource
    finally:
        resource.release()
```

### 2. High-Throughput Producer-Consumer Pattern
Decouple I/O ingestion from heavy CPU/GPU processing pipelines using bounded queues.

```python
import asyncio

async def producer(queue: asyncio.Queue, source):
    async for item in source:
        await queue.put(item)
    await queue.put(None)  # Sentinel

async def consumer(queue: asyncio.Queue):
    while True:
        item = await queue.get()
        if item is None:
            break
        await process(item)
        queue.task_done()
```

### 3. Graceful Signal Handling
Intercept `SIGINT` and `SIGTERM` for zero-loss shutdowns.

```python
import signal
import asyncio

def setup_graceful_shutdown(loop, cleanup_coro):
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(cleanup_coro()))
```

## Profiling & Performance Diagnostics

- **Python Memory**: `python -m tracemalloc` or `memray run script.py`
- **Python CPU**: `python -m cProfile -s cumulative script.py`
- **Node.js Diagnostics**: `node --inspect --prof app.js`
- **Linux System Calls**: `strace -c -f -p <PID>`
