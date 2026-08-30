---
name: python-dev
description: >-
  Provides Python engineering workflows including asyncio event loops, concurrency,
  subprocesses, sockets, memory optimization, packaging, and robust debugging.
---

# Python Engineering Skill

Dense reference for asynchronous architecture, low-level execution, concurrency, and high-performance Python patterns.

---

## 1. Environment & Package Management
```bash
# Using modern uv (instant installs and venv creation)
uv venv .venv
source .venv/bin/activate
uv pip install -U pip wheel setuptools

# Fast dependency pinning
uv pip compile pyproject.toml -o requirements.txt
```

---

## 2. Asynchronous Worker Pool with Semaphore
Control concurrency limits and handle task errors without crashing the loop.

```python
import asyncio
from typing import List, Callable, Any

async def run_worker_pool(
    items: List[Any], 
    worker_fn: Callable[[Any], Any], 
    concurrency: int = 10
) -> List[Any]:
    sem = asyncio.Semaphore(concurrency)

    async def _safe_worker(item):
        async with sem:
            try:
                return await worker_fn(item)
            except Exception as e:
                return {"error": str(e), "item": item}

    tasks = [_safe_worker(item) for item in items]
    return await asyncio.gather(*tasks)
```

---

## 3. Streaming Subprocess Execution
Capture stdout/stderr lines in real-time without buffering into memory.

```python
import asyncio

async def stream_subprocess(cmd: list[str]):
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )

    async def _read_stream(stream, prefix):
        while True:
            line = await stream.readline()
            if not line:
                break
            print(f"[{prefix}] {line.decode().rstrip()}")

    await asyncio.gather(
        _read_stream(proc.stdout, "STDOUT"),
        _read_stream(proc.stderr, "STDERR")
    )
    return await proc.wait()
```

---

## 4. High-Performance Socket Server (Asyncio Protocol)

```python
import asyncio

class EchoServerProtocol(asyncio.Protocol):
    def connection_made(self, transport):
        self.transport = transport
        peername = transport.get_extra_info('peername')
        print(f'Connection from {peername}')

    def data_received(self, data):
        # Process and write back
        self.transport.write(data)

    def connection_lost(self, exc):
        pass

async def main():
    loop = asyncio.get_running_loop()
    server = await loop.create_server(EchoServerProtocol, '127.0.0.1', 8888)
    async with server:
        await server.serve_forever()
```
