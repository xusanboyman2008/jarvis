# PW Game Architecture & Engine

## System Overview
- **Engine Core:** Custom 2.5D / 3D Tilemap Engine
- **Asset Pipeline:** GLTF / GLB 3D character models with blend shapes and animations
- **Map System:** Chunk-based dynamic loading with pathfinding grid
- **Networking:** Low-latency WebSocket synchronization for multi-entity interaction

## Key Modules
1. **Renderer:** Three.js WebGL canvas pipeline with post-processing bloom and dynamic lighting
2. **Physics & Collision:** Grid-aligned AABB bounding checks + raycasting for obstacle heights
3. **Entity Manager:** Component-based entity loop for player avatars, NPCs, and interactive items
4. **State Machine:** Client-side prediction with authoritative state reconciliation

## Controls & Gestures
- Movement: WASD / Arrow Keys or pinch-drag tracking
- Action: Spatial gestures / hand-tracked target selection
- Camera: Orbit controls with adaptive focal depth
