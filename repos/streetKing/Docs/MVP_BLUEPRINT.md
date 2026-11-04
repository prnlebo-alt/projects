# STREETKING MVP Implementation Blueprint

## What this scaffold delivers now

- Core match loop with score-to-win.
- Ball rebound + rally escalation logic.
- Four+one shot type model (standard/curve/drop/lob/slam).
- Player movement with jump and dive.
- AI input adapter using same controller path as human input.
- HUD hooks for score/rally/winner text.

## Next Implementation Pass (Priority order)

1. Mobile controls (virtual joystick + swipe recognizer)
2. Hit stop, camera shake, and impact FX tuning
3. Rally phase-based audio/visual escalation bands
4. Character-specific specials (1 each)
5. Court dressing and readability polish

## Tuning targets

- Serve-to-serve average rally under 7 touches for casuals
- High-skill rally > 15 touches frequently possible
- Input-to-hit latency budget under 80ms on target mobile devices
- First-to-7 matches averaging 45-90 seconds
