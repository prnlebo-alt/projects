# Level solver results

Headless brute-force solver (`solver.js`) running the REAL game script (`harness.js` loads `index.html`'s own `<script>` body into a Node `vm` context, stubbing DOM/canvas/audio/localStorage) so results use the same physics, blocks, and win logic as play — no reimplementation.

Method: for each bag, grid-search elevation (11 angles) x power (7 levels), simulate each candidate shot to resolution + settle time, score by (bin filled > bin hit progress > block hp removed > closest approach), commit the best, repeat until won or out of bags.

| Level | World | Par | Par+2 | Blocks | Result | Bags used | Shots log |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 2 | 4 | 0 | WIN | 1 | #1 el28 t0.9+tap |
| 2 | 1 | 2 | 4 | 0 | WIN | 1 | #1 el52 t0.8 |
| 3 | 1 | 3 | 5 | 0 | WIN | 1 | #1 el60 t1+tap |
| 4 | 2 | 3 | 5 | 2 | WIN | 1 | #1 el68 t0.8+tap |
| 5 | 2 | 4 | 6 | 3 | WIN | 1 | #1 el52 t0.8+tap |
| 6 | 2 | 3 | 5 | 3 | WIN | 1 | #1 el76 t0.9 |
| 7 | 3 | 3 | 5 | 3 | WIN | 1 | #1 el28 t0.8+tap |
| 8 | 3 | 4 | 6 | 2 | WIN | 1 | #1 el68 t0.9+tap |
| 9 | 3 | 5 | 7 | 2 | WIN | 2 | #1 el68 t0.9, #2 el44 t0.8 |
| 10 | 4 | 3 | 5 | 3 | WIN | 1 | #1 el68 t0.9+tap |
| 11 | 4 | 5 | 7 | 3 | WIN | 1 | #1 el20 t0.7+tap |
| 12 | 4 | 4 | 6 | 2 | WIN | 1 | #1 el84 t1+tap |
| 13 | 5 | 5 | 7 | 4 | WIN | 1 | #1 el52 t0.8+tap |
| 14 | 5 | 5 | 7 | 2 | WIN | 2 | #1 el68 t0.5+tap, #2 el52 t0.8+tap |
| 15 | 5 | 7 | 9 | 2 | WIN | 1 | #1 el68 t0.7+tap |

**Summary: 15/15 levels winnable. All within par+2 bags.**

Notes: this is a greedy per-bag solver (not full multi-bag combinatorics), so a FAIL here means the greedy search did not find a path, not a formal proof of unsolvability; a level that WINs is a real, physics-verified winning sequence. Block structures were authored to sit beside bins (not blocking direct entry) except level 8, which is the designated tower-collapse level.
