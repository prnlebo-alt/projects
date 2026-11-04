# STREETKING MVP Prototype

Unity/C# prototype scaffold for a 2.5D arcade handball game.

## Current Scope

This repo includes a playable-code foundation for:

- 1v1 court flow
- Player movement (run, jump, dive)
- Ball-wall rebound loop
- Rally escalation
- Simple AI return behavior
- Score to win state
- Basic HUD hooks + hype state text
- Camera shake juice driven by hit intensity

## Suggested Unity Setup

1. Create a 3D URP project in Unity 2022 LTS+.
2. Copy this repository into project root or copy `Assets/` folder into project.
3. Create a scene `Assets/Scenes/StreetKingPrototype.unity`.
4. Add objects:
   - `GameManager` with `GameManager` component
   - `MainCamera` with `CameraJuice` component
   - `Ball` with Rigidbody + SphereCollider + `BallController`
   - `CenterWall` with BoxCollider + tag `Wall`
   - `PlayerHuman` with Rigidbody + CapsuleCollider + `PlayerController`
   - `PlayerAI` with Rigidbody + CapsuleCollider + `PlayerController` + `AIController`
   - UI canvas with `HUDController` and TMP text refs for score/rally/winner/hype
5. Add out bounds trigger/collider objects tagged `OutLeft` and `OutRight`.
6. Add ground collider tagged `Ground`.
7. Wire references in inspector.
8. Press play and tune values for feel.

## Controls (desktop test harness)

- Move: A/D or Left/Right
- Jump: W/UpArrow/Space
- Dive: LeftShift
- Shot type: 1=Standard, 2=Curve, 3=Drop, 4=Lob, 5=Slam
- Hit: J/K/L

## Mobile Input Note

A mobile input adapter interface is provided so touch controls can be plugged in without changing core movement/shot logic.


## Fastest Playtest

See `Docs/RUNBOOK_FASTEST_PLAYTEST.md` for the quickest setup path, AI-vs-AI attract mode, and first blockers.
