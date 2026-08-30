# ⚡ JARVIS — Autonomous Spatial Vision & 3D Holographic HUD

> **🚀 Live Web App Running Link:**  
> ### [https://xusanboyman2008.github.io/jarvis/](https://xusanboyman2008.github.io/jarvis/)
> **✨ Barehands Glass Stage:** [https://xusanboyman2008.github.io/jarvis/stage.html](https://xusanboyman2008.github.io/jarvis/stage.html)

---

## 🌟 What is JARVIS?

**JARVIS** is an unrestricted, high-precision, webcam-powered spatial vision and hand-tracking interface. It turns your webcam and browser into an Iron Man-style spatial HUD:

- 🪖 **3D Spatial Manipulation**: Rotate, scale, grab, and throw 3D GLB models in real-time with bare hands (no headset, no controllers).
- 👐 **Dual-Hand Independent Control**: Hold and move two separate 3D objects simultaneously using both hands.
- 🔄 **Direct 3D Model Rotation**: Use an index+middle 2-finger posture to rotate models freely in pitch, yaw, and roll inside fixed holographic bounds.
- 🔍 **Dynamic Optical Scaling**: Pinch or spread thumb and pointer to expand and shrink 3D models seamlessly.
- 🧲 **Laser Dwell & Force Pull**: Target objects from afar with a laser beam and clench a fist to summon them to your hand.
- 🖼️ **3D Media & Image Scroller / Carousel**: Holographic card deck to browse and stage 3D models and image props using hand swipes.
- 🎵 **Cyberpunk Web Audio Synthesizer**: Built-in electronic music generator and real-time FFT spectrum visualizer.
- 📡 **OBS Broadcast Mirror (`?role=render`)**: Alpha-transparent overlay for live streaming and recording.

---

## 🖐️ Gesture Controls Quick Reference

| Gesture | Action | Description |
| :--- | :--- | :--- |
| **👐 Dual-Hand Grab** | 👈 Left + 👉 Right | Hold and move 2 separate 3D objects at the same time |
| **✌️ 2-Finger (Index+Middle)** | 🔄 **3D Rotation** | Rotate 3D models smoothly in Pitch, Yaw, and Roll inside their boxes |
| **🤏 2-Finger (Thumb+Pointer)** | 🔍 **Optical Scaling** | Spread fingers to scale up, pinch together to scale down |
| **✊ Fist Grab & Swipe** | ⚡ **Momentum Throw** | Grab instantly with a fist and flick/swipe to throw with zero bounce |
| **👉 Laser + 🖐️ Open + ✊ Fist** | 🧲 **Force Pull** | Dwell on an object with laser pointer, open hand, then clench fist to pull it |
| **👉 1-Finger Pointer** | 🎯 **Target & Select** | Point at an object to select it with laser dwell confirmation |
| **🗑️ Release 90%+ Offscreen** | 🗑️ **Delete Object** | Warning in red at 70%, release at 90%+ outside bounds to delete |
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
