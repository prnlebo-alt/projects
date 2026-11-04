# STREETKING Fastest Playable Test Path

## Project type check
This repository is **not currently a full Unity project** and is **not an Xcode/iOS project**.

What exists now:
- gameplay C# scripts under `Assets/Scripts/*`
- docs (`README.md`, `Docs/MVP_BLUEPRINT.md`)

What is missing for a true Unity project:
- `ProjectSettings/`
- `Packages/manifest.json`
- `.unity` scene assets
- prefabs/materials/audio assets

So classification is: **(3) something else** — a Unity gameplay-script scaffold that must be dropped into a Unity project.

---

## Fastest run path (desktop)

1. Install **Unity Hub** and **Unity 2022.3 LTS** (or newer LTS).
2. Create a new project:
   - Template: **3D (URP optional)**
   - Name: `StreetKingPlaytest`
3. Close Unity, then copy this repo's `Assets/` folder into that project (overwrite if prompted).
4. Re-open project in Unity.
5. Create scene: `Assets/Scenes/StreetKingPrototype.unity`.
6. Build minimum objects in hierarchy:
   - `GameManager` (attach `GameManager`)
   - `Main Camera` (attach `CameraJuice`)
   - `Ground` (Cube or Plane, Collider, tag `Ground`)
   - `CenterWall` (Cube with Collider, tag `Wall`)
   - `Ball` (Sphere + Rigidbody + SphereCollider + `BallController`)
   - `OutLeft` (thin Cube Collider, tag `OutLeft`)
   - `OutRight` (thin Cube Collider, tag `OutRight`)
   - `PlayerLeft` (Capsule + Rigidbody + CapsuleCollider + `PlayerController`)
   - `PlayerRight` (Capsule + Rigidbody + CapsuleCollider + `PlayerController` + `AIController`)
7. For each player, add a child empty object named `HandPoint` near the hand area and assign it to `handPoint`.
8. On `BallController`, assign `gameManager` reference.
9. On `GameManager`, assign `ball`, `playerOne`, `playerTwo`, `hud` (optional), `cameraJuice`.
10. Hit Play.

---

## Keyboard controls (desktop harness)
- Move: `A/D` or `Left/Right`
- Jump: `W`, `UpArrow`, or `Space`
- Dive: `LeftShift`
- Shot type: `1` Standard, `2` Curve, `3` Drop, `4` Lob, `5` Slam
- Hit: `J/K/L`

---

## AI-vs-AI attract mode (no code changes required)
Use this to get moving gameplay immediately:

1. On **both** players:
   - set `PlayerController.isHuman = false`
   - add `AIController`
2. On each `AIController`, set `targetBall` to the Ball object.
3. Ensure both players still have Rigidbody + Collider + assigned `handPoint`.
4. Press Play.

If you want to watch without interacting, this is the fastest attract loop.

---

## First blockers you are likely to hit

1. **No Unity scene exists in repo**
   - Symptom: nothing to run when opening repo directly.
2. **No Unity project metadata exists**
   - Symptom: cannot open repo directly in Unity as a complete project.
3. **Null references from unassigned inspector fields**
   - Common fields: `GameManager.ball`, `playerOne`, `playerTwo`; `BallController.gameManager`; `PlayerController.handPoint`; `AIController.targetBall`.
4. **Tag setup missing**
   - Must create/use tags: `Ground`, `Wall`, `OutLeft`, `OutRight`.
5. **HUD text dependency not wired**
   - `HUDController` uses `TMPro.TMP_Text`; if no Canvas/TMP text assigned, HUD will appear blank (gameplay still runs).

---

## Correct file/scene to open
- Script entrypoint to inspect orchestration: `Assets/Scripts/Core/GameManager.cs`
- Scene to create/open for runtime: `Assets/Scenes/StreetKingPrototype.unity`
