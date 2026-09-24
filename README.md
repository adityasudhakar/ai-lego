# Bolt the Brick Bot

A 138-piece robot built from standard LEGO bricks, plates and tiles. It was designed and checked in code, then turned into a printable instruction booklet and a build animation with ASMR sound.

![Bolt the Brick Bot](docs/hero.jpg)

- **Watch:** [`bolt-showreel.mp4`](bolt-showreel.mp4). 36 seconds with sound: a flip-through of the booklet, then every piece sliding and clicking into place.
- **Build it:** [`bolt-instructions.pdf`](bolt-instructions.pdf). 37 pages: cover, parts list and 31 steps.
- **Spin it:** [interactive 3D viewer](https://claude.ai/artifact/7Brrus3CuZGsxKiD9zyQbr), with step-by-step and exploded views.
- **Order the parts:** open [`robot.ldr`](robot.ldr) in BrickLink Studio or LeoCAD.

![The booklet flip-through](docs/booklet.jpg)

## What the checker verifies

`design.py` places every part on a stud grid, then replays the build in booklet order and checks each step:

| Check | Result |
|---|---|
| Pieces | 138 in 41 part/colour lots |
| Size | 12.0 × 6.4 × 14.4 cm |
| Collisions | 0 |
| Stud connections | 559 |
| One connected structure | Yes |
| Every step buildable | Yes. Each part clips onto parts already built, from a direction that is still open |
| Stands at every step | Yes. The final centre of mass is 2.3 studs inside the feet |
| Single-stud joints | 1 (the antenna tip) |

The arms and backpack hang under the shoulders, so the booklet has you push them on from below after the shoulder layer is built.

## How it works

| File | Role |
|---|---|
| `design.py` | The robot as layers of coloured cells. A backtracking tiler covers each layer with real parts so every part rests on studs. Runs the checks, then writes `robot.ldr` and `model.js`. |
| `lego3d.js` | three.js part meshes, camera framing, and the showreel timeline. |
| `book3d.js` | The booklet as a 3D book with curling pages for the intro. |
| `asmr.js` | Procedural Web Audio sound: slides, stud clicks (pitched by part size, panned by position), page flips and whooshes. |
| `viewer.html` | Interactive viewer. |
| `booklet.html` | The instruction booklet layout, rendered live in the browser. |
| `record.html`, `export.mjs` | Headless Chrome export of the PDF, page images and MP4 (ffmpeg). |

## Rebuild

Needs Python 3, Node 18+, Google Chrome and ffmpeg.

```sh
npm install
npm run design   # redesign + checks -> robot.ldr, model.js
npm run pdf      # bolt-instructions.pdf + pages/*.jpg
npm run video    # bolt-showreel.mp4 (about 15 min on an older laptop)
npm run serve    # then open http://localhost:8000/viewer.html
```

To change the robot, edit the `layer(...)` calls in `design.py` and rerun it. The checker reports any collision, floating part or unbuildable step.

---

Designed with Claude Opus 5.5. LEGO® is a trademark of the LEGO Group, which does not sponsor or endorse this project.
