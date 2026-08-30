---
name: web-scraping-paging
description: >-
  Handles web pagination patterns (offset/limit, cursor-based, infinite scroll, page tokens),
  browser automation with Playwright/Puppeteer, and high-performance crawling.
---

# Web Scraping & Pagination Skill

Dense, high-throughput workflows for scraping multi-page web applications, handling dynamic pagination, cursor tokens, and headless browser automation.

---

## 1. Async HTTP Pagination Crawler (Offset & Cursor)
Fetch pages concurrently while respecting rate limits.

```python
import asyncio
import httpx
from typing import AsyncGenerator, Dict, Any

async def fetch_paginated_api(
    base_url: str, 
    headers: Dict[str, str], 
    params: Dict[str, Any], 
    page_param: str = "page", 
    limit: int = 50,
    max_pages: int = 100
) -> AsyncGenerator[list, None]:
    """Asynchronously iterates through paginated REST APIs."""
    async with httpx.AsyncClient(headers=headers, timeout=15.0) as client:
        current_page = 1
        while current_page <= max_pages:
            req_params = {**params, page_param: current_page, "limit": limit}
            resp = await client.get(base_url, params=req_params)
            
            if resp.status_code != 200:
                print(f"Failed page {current_page}: {resp.status_code}")
                break
                
            data = resp.json()
            items = data.get("results") or data.get("items") or data.get("data") or data
            
            if not items or len(items) == 0:
                break
                
            yield items
            current_page += 1
```

---

## 2. Playwright Infinite Scroll & "Load More" Paging
Automate infinite scroll pages and dynamic DOM rendering.

```python
import asyncio
from playwright.async_api import async_playwright

async def scrape_infinite_scroll(url: str, item_selector: str, max_scrolls: int = 20):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        await page.goto(url, wait_until="networkidle")

        previous_height = await page.evaluate("document.body.scrollHeight")
        scroll_count = 0

        while scroll_count < max_scrolls:
            # Scroll to bottom
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(1500)  # Wait for AJAX

            # Check for 'Load More' buttons if present
            load_more = await page.query_selector("button.load-more, a.load-more, text='Load More'")
            if load_more and await load_more.is_visible():
                await load_more.click()
                await page.wait_for_timeout(1500)

            new_height = await page.evaluate("document.body.scrollHeight")
            if new_height == previous_height:
                break  # Reached the end
            previous_height = new_height
            scroll_count += 1

        elements = await page.query_selector_all(item_selector)
        results = [await el.inner_text() for el in elements]
        await browser.close()
        return results
```

---

## 3. Link Header (RFC 5988) Pagination Parser
Handle GitHub, GitLab, and standard REST API pagination headers.

```python
import re
from typing import Optional

def get_next_page_url(link_header: Optional[str]) -> Optional[str]:
    """Extract next URL from HTTP Link header: <url>; rel="next"."""
    if not link_header:
        return None
    match = re.search(r'<([^>]+)>;\s*rel="next"', link_header)
    return match.group(1) if match else None
```
