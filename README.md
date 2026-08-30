# ⚡ JARVIS — Autonomous Spatial Vision & Holographic HUD

> **🚀 Live Web App (Run in Browser):**  
> ### [https://xusanboyman2008.github.io/jarvis/](https://xusanboyman2008.github.io/jarvis/)
> **✨ Barehands Glass Stage:** [https://xusanboyman2008.github.io/jarvis/stage.html](https://xusanboyman2008.github.io/jarvis/stage.html)

---

## 🌟 What is JARVIS?

**JARVIS** is an unrestricted, high-precision, webcam-powered spatial vision and hand-tracking interface. It turns your webcam and browser into an Iron Man-style spatial HUD:

- 🪖 **3D Spatial Manipulation**: Rotate, scale, grab, and throw 3D GLB models in real-time with bare hands (no headset, no controllers).
- 🖼️ **3D Media & Image Scroller / Carousel**: Holographic card deck to browse and stage 3D models and image props using hand swipes.
- 🎵 **Cyberpunk Web Audio Synthesizer**: Built-in 4-track electronic music generator and real-time FFT spectrum visualizer.
- 📝 **Markdown & Notes Vaults**: Full Obsidian vault and Markdown note browsing on floating glass cards.
- ⚡ **AI Ring Face & Command API**: Universal REST command channel (`/cmd`, `/state`, `/orb`) to wire any AI assistant (Claude, Gemini, GPT, local LLMs) to drive the ring and stage items.
- 📡 **OBS Broadcast Mirror (`?role=render`)**: Alpha-transparent overlay for live streaming and recording.

---

## 🖐️ Gesture Controls Quick Reference

| Gesture | Action | Description |
| :--- | :--- | :--- |
| **Tap Ring** | 🌸 **Bloom Orbs Menu** | Expands Notes, 3D Models, Sketch, Explode, and Recall orbs |
| **Pinch & Drag** | 🤏 **Move & Position** | Grab any glass card or 3D object to reposition |
| **✌️ 2-Finger (Index+Middle)** | 🔄 **3D Rotation** | Rotate 3D models smoothly in Pitch, Yaw, and Roll |
| **🤏 2-Finger (Thumb+Pointer)** | 🔍 **Optical Scaling** | Spread to scale up, pinch to scale down |
| **✊ Fist Grab** | ⚡ **Momentum Throw** | Grab and flick/swipe to throw with physics momentum |
| **👉 Laser + 🖐️ Open + ✊ Fist** | 🧲 **Force Pull** | Dwell on an object from across the room and clench fist to rip it to your hand |
| **👏 Clap Hands** | 🎯 **Recall / Center** | Palms together sweeps the board clean or centers the AI Ring |
| **☝️ 1-Finger Point** | ✏️ **3D Air Sketch** | Draw glowing neon light trails floating in 3D air |
| **Press [G] or Chooser Button** | 🖼️ **3D Media Carousel** | Opens interactive 3D coverflow scroller for models & images |
| **Press [M] or Music Button** | 🎵 **Toggle Synth Music** | Plays / pauses cyberpunk synthwave sound generator |

---

## 🚀 Run Locally

### 1. Clone & Start Server
```bash
git clone https://github.com/xusanboyman2008/jarvis.git
cd jarvis
python3 server.py
```

### 2. Open in Chrome
- **Vision.Core 3D Playground:** [http://127.0.0.1:8080/](http://127.0.0.1:8080/)
- **JARVIS Glass Stage:** [http://127.0.0.1:8080/stage.html](http://127.0.0.1:8080/stage.html)
- **OBS Transparent Mirror:** [http://127.0.0.1:8080/stage.html?role=render](http://127.0.0.1:8080/stage.html?role=render)

---

## 💻 CLI & AI Agent Dispatcher

Control JARVIS from terminal or external AI assistants:

```bash
# Spotlight a card on the glass stage
./bin/board.sh '{"a":"present","title":"STATUS","body":"JARVIS Neural Network Active"}'

# Stage a 3D Model
./bin/board.sh '{"a":"hand","src":"models/robot_expressive.glb"}'

# Explode a parted 3D model
./bin/board.sh '{"a":"explode"}'

# Update the AI Ring status & mood
./bin/jarvis-face.sh thinking cyan
```

---

## 📦 3D Model Catalog Included
- 🪖 `damaged_helmet.glb` (Sci-Fi Battle Damaged PBR Helmet)
- 🤖 `robot_expressive.glb` (Animated Expressive Cyber Robot)
- ⚔️ `cyber_warrior.glb` (Futuristic Guardian)
- 🦸‍♀️ `cyber_heroine.glb` (Hi-Poly Sci-Fi Hero)
- 👑 `king.glb` (Royal Avatar & Crown)
- 👤 `borbur.glb` (Spatial Mesh)
- 🦩 `flamingo.glb` (Gliding Neon Bird)
- 🐎 `horse.glb` (Cyber Steed)
- 🐙 `octopus.glb` (Tentacle Fluid Rig)
- 👨‍🚀 `astronaut.glb` (Zero-G Cosmonaut)

---

## 📜 License
AGPL-3.0 License. Open-source and free to use.
