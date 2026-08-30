---
name: telegram-bot-api
description: >-
  Covers Telegram Bot API and MTProto client development with aiogram, python-telegram-bot,
  and Telethon for bots, userbots, media dispatch, and event handling.
---

# Telegram Bot & MTProto Automation Skill

Dense, production-ready architectures for Telegram Bot API (v7.x+), `aiogram 3.x`, direct HTTP API dispatch, and `Telethon` MTProto userbot automation.

---

## 1. Direct Telegram Bot API Client (Lightweight HTTPX)
Zero external Telegram libraries; directly call Telegram Bot HTTP API with async `httpx`.

```python
import httpx
import io

class TelegramBotClient:
    def __init__(self, token: str):
        self.base_url = f"https://api.telegram.org/bot{token}"
        self.client = httpx.AsyncClient(timeout=30.0)

    async def send_message(self, chat_id: int | str, text: str, parse_mode: str = "HTML", reply_markup: dict = None):
        payload = {"chat_id": chat_id, "text": text, "parse_mode": parse_mode}
        if reply_markup:
            payload["reply_markup"] = reply_markup
        resp = await self.client.post(f"{self.base_url}/sendMessage", json=payload)
        return resp.json()

    async def send_photo_bytes(self, chat_id: int | str, photo_bytes: bytes, caption: str = ""):
        files = {"photo": ("frame.jpg", io.BytesIO(photo_bytes), "image/jpeg")}
        data = {"chat_id": chat_id, "caption": caption}
        resp = await self.client.post(f"{self.base_url}/sendPhoto", data=data, files=files)
        return resp.json()

    async def close(self):
        await self.client.aclose()
```

---

## 2. Aiogram 3.x Production Bot Template
Complete asynchronous dispatcher with routers, error handling, and inline keyboards.

```python
import asyncio
import logging
from aiogram import Bot, Dispatcher, Router, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton

router = Router()

def get_action_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📸 Capture Frame", callback_data="cam_capture")],
        [InlineKeyboardButton(text="📊 System Status", callback_data="sys_status")]
    ])

@router.message(CommandStart())
async def cmd_start(message: Message):
    await message.answer(
        "<b>System Controller Active.</b>\nSelect an action:",
        reply_markup=get_action_keyboard(),
        parse_mode="HTML"
    )

@router.callback_query(F.data == "cam_capture")
async def cb_capture(query: CallbackQuery, bot: Bot):
    await query.answer("Capturing frame...")
    # Hook into camera-vision capture workflow
    await query.message.answer("📸 Snapshot captured and processed.")

async def main():
    logging.basicConfig(level=logging.INFO)
    BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"
    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()
    dp.include_router(router)

    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 3. Telethon (MTProto Userbot Client)
Automate custom Telegram user accounts for bulk channels, scraping, and real-time event listening.

```python
from telethon import TelegramClient, events

api_id = 1234567
api_hash = 'your_api_hash'

client = TelegramClient('session_name', api_id, api_hash)

@client.on(events.NewMessage(pattern=r'\.ping'))
async def handler(event):
    await event.reply('pong!')

@client.on(events.NewMessage(incoming=True))
async def log_incoming(event):
    if event.is_private:
        sender = await event.get_sender()
        print(f"Direct message from {sender.id}: {event.text}")

async def main():
    await client.start()
    print("Telethon client listening...")
    await client.run_until_disconnected()

if __name__ == '__main__':
    with client:
        client.loop.run_until_complete(main())
```
