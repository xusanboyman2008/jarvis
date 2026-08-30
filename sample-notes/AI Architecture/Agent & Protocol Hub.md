# AI Agent & Protocol Hub

## Communication Protocols
- **State Channel:** `state/state` (idle | listening | thinking | speaking)
- **Mood Telemetry:** `state/mood.json` (`{"mood": "green"|"amber"|"red"}`)
- **Waveform Audio:** `state/wave.json` (64-point audio amplitudes)
- **Action Ingress:** `POST http://127.0.0.1:8794/cmd`

## Stage Action Commands
```bash
# Present note center-stage spotlighted
./bin/board.sh '{"a":"present","title":"TARGET","body":"Payload details"}'

# Stage 3D Model
./bin/board.sh '{"a":"add_img","src":"models/borbur.glb"}'

# Stage Hologram Wireframe
./bin/board.sh '{"a":"add_img","src":"holo/king_model_standard.glb"}'
```
