#!/usr/bin/env python3
"""Design, verify and export a small brick-built robot.

Units: x, z in studs; y in plates (a brick is 3 plates tall). y = 0 is the ground.
Front of the model faces -z (row z = 0 is the front).

Outputs:
  robot.ldr   LDraw model with STEP markers (opens in BrickLink Studio / LeoCAD)
  model.js    parts, steps, inventory and check results for the viewer and booklet
"""
import json
import random
from collections import defaultdict

# ---------------------------------------------------------------- catalog
# (kind, w, d) -> (LDraw id, name). w runs along x in the part's default LDraw orientation.
CATALOG = {
    ("brick", 1, 1): ("3005", "Brick 1 x 1"),
    ("brick", 2, 1): ("3004", "Brick 1 x 2"),
    ("brick", 3, 1): ("3622", "Brick 1 x 3"),
    ("brick", 4, 1): ("3010", "Brick 1 x 4"),
    ("brick", 6, 1): ("3009", "Brick 1 x 6"),
    ("brick", 2, 2): ("3003", "Brick 2 x 2"),
    ("brick", 3, 2): ("3002", "Brick 2 x 3"),
    ("brick", 4, 2): ("3001", "Brick 2 x 4"),
    ("plate", 1, 1): ("3024", "Plate 1 x 1"),
    ("plate", 2, 1): ("3023", "Plate 1 x 2"),
    ("plate", 3, 1): ("3623", "Plate 1 x 3"),
    ("plate", 4, 1): ("3710", "Plate 1 x 4"),
    ("plate", 6, 1): ("3666", "Plate 1 x 6"),
    ("plate", 2, 2): ("3022", "Plate 2 x 2"),
    ("plate", 3, 2): ("3021", "Plate 2 x 3"),
    ("plate", 4, 2): ("3020", "Plate 2 x 4"),
    ("plate", 6, 2): ("3795", "Plate 2 x 6"),
    ("tile", 1, 1): ("3070b", "Tile 1 x 1"),
    ("tile", 2, 1): ("3069b", "Tile 1 x 2"),
    ("tile", 3, 1): ("63864", "Tile 1 x 3"),
    ("tile", 4, 1): ("2431", "Tile 1 x 4"),
    ("tile", 2, 2): ("3068b", "Tile 2 x 2"),
    ("tile", 4, 2): ("87079", "Tile 2 x 4"),
    ("round_brick", 1, 1): ("3062b", "Brick 1 x 1 Round"),
    ("round_plate", 1, 1): ("4073", "Plate 1 x 1 Round"),
}
HEIGHT = {"brick": 3, "plate": 1, "tile": 1, "round_brick": 3, "round_plate": 1}
STUDDED = {"brick", "plate", "round_brick", "round_plate"}  # tiles have smooth tops

# LDraw colour code -> (name, hex)
COLORS = {
    0: ("Black", "#1B2A34"),
    1: ("Blue", "#1E5AA8"),
    4: ("Red", "#B40000"),
    14: ("Yellow", "#FAC80A"),
    15: ("White", "#F4F4F4"),
    25: ("Orange", "#D67923"),
    36: ("Trans-Red", "#C91A09"),
    43: ("Trans-Light Blue", "#AEE9EF"),
    71: ("Light Bluish Gray", "#A0A5A9"),
    72: ("Dark Bluish Gray", "#6C6E68"),
}
BLACK, BLUE, RED, YELLOW, WHITE, ORANGE, TRED, TLBLUE, LTGRAY, DKGRAY = 0, 1, 4, 14, 15, 25, 36, 43, 71, 72

# ---------------------------------------------------------------- shape
# Each layer: kind, list of boxes (x0, x1, z0, z1, color[, kind][, tag]). Later boxes win.
# tag "body" is built bottom-up; tags "armL"/"armR" hang under the shoulders and are built top-down.
LAYERS = []


def layer(kind, *boxes, name=""):
    cells = {}
    for b in boxes:
        x0, x1, z0, z1, color = b[:5]
        k = b[5] if len(b) > 5 and b[5] else kind
        tag = b[6] if len(b) > 6 else "body"
        for x in range(x0, x1):
            for z in range(z0, z1):
                cells[(x, z)] = (color, k, tag)
    LAYERS.append({"kind": kind, "cells": cells, "name": name})


def arms(color):
    return [(-2, 0, 2, 5, color, None, "armL"), (11, 13, 2, 5, color, None, "armR")]


FOOT_L, FOOT_R = (1, 4, 0, 6), (7, 10, 0, 6)
LEG_L, LEG_R = (1, 4, 2, 5), (7, 10, 2, 5)
BODY = (1, 10, 1, 6)
HEAD = (2, 9, 1, 6)

layer("plate", (*FOOT_L, ORANGE), (*FOOT_R, ORANGE), name="feet")
layer("brick", (*FOOT_L, ORANGE), (*FOOT_R, ORANGE), name="feet")
layer("brick", (*LEG_L, DKGRAY), (*LEG_R, DKGRAY), name="legs")
layer("brick", (*LEG_L, LTGRAY), (*LEG_R, LTGRAY), name="knees")
layer("brick", (*LEG_L, DKGRAY), (*LEG_R, DKGRAY), name="legs")
layer("plate", (*BODY, DKGRAY), name="hips")
layer("brick", (*BODY, DKGRAY), name="hips")
def pack(color):
    return (3, 8, 6, 8, color, None, "pack")


layer("brick", (*BODY, WHITE), (3, 8, 1, 2, LTGRAY), *arms(LTGRAY), pack(ORANGE), name="torso")   # belt, hands, jets
layer("brick", (*BODY, WHITE), (3, 8, 1, 2, BLUE), (4, 5, 1, 2, RED), (6, 7, 1, 2, YELLOW),
      *arms(WHITE), pack(LTGRAY), name="torso")                                                   # chest buttons
layer("brick", (*BODY, WHITE), (3, 8, 1, 2, BLUE), *arms(DKGRAY), pack(LTGRAY), name="torso")    # upper arms
layer("brick", (*BODY, WHITE), (-2, 13, 2, 5, DKGRAY), (3, 8, 5, 8, DKGRAY), name="shoulders")
layer("plate", (4, 7, 2, 5, DKGRAY), name="neck")
layer("plate", (*HEAD, DKGRAY), name="jaw")
layer("brick", (*HEAD, WHITE), (4, 7, 1, 2, DKGRAY), name="head")                           # mouth
layer("brick", (*HEAD, WHITE), (1, 10, 2, 5, DKGRAY), (3, 8, 1, 2, BLACK),
      (4, 5, 1, 2, YELLOW), (6, 7, 1, 2, YELLOW), name="head")                              # visor, eyes, ears
layer("brick", (*HEAD, WHITE), name="head")
layer("tile", (*HEAD, WHITE), (5, 6, 3, 4, DKGRAY, "plate"), name="head top")
layer("round_brick", (5, 6, 3, 4, DKGRAY), name="antenna")
layer("round_plate", (5, 6, 3, 4, TRED), name="antenna")

ARM_TAGS = {"armL", "armR", "pack"}  # parts hung under the shoulders


# ---------------------------------------------------------------- tiling
def orientations(kind):
    out = []
    for (k, w, d), (pid, name) in CATALOG.items():
        if k != kind:
            continue
        out.append((w, d, False, pid, name))
        if w != d:
            out.append((d, w, True, pid, name))
    return out


def tile_region(cells, key, y, support_owner, rng, prefer_x, node_limit=4000):
    """Cover the cells whose value == key with parts, scanning from a random corner.
    Backtracks so that every part of a bottom-up group rests on at least one stud below it;
    falls back to the best greedy cover if no such tiling turns up within node_limit."""
    color, kind, tag = key
    todo = {c for c, v in cells.items() if v == key}
    sx, sz = rng.choice((1, -1)), rng.choice((1, -1))
    scan = sorted(todo, key=(lambda c: (sz * c[1], sx * c[0])) if prefer_x else (lambda c: (sx * c[0], sz * c[1])))
    need_support = y > 0 and tag not in ARM_TAGS
    covered, chosen = set(), []
    nodes = [0]

    def candidates(cell, strict):
        x0, z0 = cell
        out = []
        for w, d, rot, pid, name in orientations(kind):
            fp = [(x0 + sx * i, z0 + sz * j) for i in range(w) for j in range(d)]
            if not all(c in todo and c not in covered for c in fp):
                continue
            below = {support_owner[c] for c in fp if c in support_owner}
            if strict and need_support and not below:
                continue
            score = w * d * 10 + 14 * max(0, len(below) - 1) + (3 if (w >= d) == prefer_x else 0)
            out.append((score + rng.random() * 12, w, d, rot, pid, name, fp))
        out.sort(reverse=True)
        return out

    def solve(k):
        while k < len(scan) and scan[k] in covered:
            k += 1
        if k == len(scan):
            return True
        nodes[0] += 1
        if nodes[0] > node_limit:
            return False
        for cand in candidates(scan[k], strict=True):
            covered.update(cand[6])
            chosen.append(cand)
            if solve(k + 1):
                return True
            chosen.pop()
            covered.difference_update(cand[6])
        return False

    if not solve(0):
        covered.clear()
        chosen.clear()
        for cell in scan:
            if cell not in covered:
                cand = candidates(cell, strict=False)[0]
                covered.update(cand[6])
                chosen.append(cand)

    return [{"id": pid, "name": name, "kind": kind, "x": min(c[0] for c in fp), "z": min(c[1] for c in fp),
             "w": w, "d": d, "y": y, "h": HEIGHT[kind], "color": color, "rot": rot, "tag": tag}
            for _, w, d, rot, pid, name, fp in chosen]


def tile_layer(li, lay, y, support_owner, rng):
    keys = sorted(set(lay["cells"].values()), key=str)
    parts = []
    for key in keys:
        parts += tile_region(lay["cells"], key, y, support_owner, rng, prefer_x=(li % 2 == 0))
    return parts


def tile_quality(parts, support_owner, y):
    unsupported = 0
    bonds = 0
    for p in parts:
        if p["tag"] in ARM_TAGS or y == 0:
            continue
        fp = [(p["x"] + i, p["z"] + j) for i in range(p["w"]) for j in range(p["d"])]
        below = {support_owner[c] for c in fp if c in support_owner}
        if not below:
            unsupported += 1
        bonds += len(below)
    return unsupported * 10000 + len(parts) * 10 - bonds * 6


def design(seed=7, tries=120):
    rng = random.Random(seed)
    all_parts, layer_parts = [], []
    tops = {}  # (x, z) -> index of part whose studded top is at current y
    y = 0
    for li, lay in enumerate(LAYERS):
        h = HEIGHT[lay["kind"]]
        # hanging groups are attached after the body above them, so they never count as support
        support = {c: owner for c, (owner, top) in tops.items()
                   if top == y and all_parts[owner]["tag"] not in ARM_TAGS}
        best, best_q = None, None
        for _ in range(tries):
            cand = tile_layer(li, lay, y, support, rng)
            q = tile_quality(cand, support, y)
            if best_q is None or q < best_q:
                best, best_q = cand, q
        idx0 = len(all_parts)
        for i, p in enumerate(best):
            p["layer"] = li
            all_parts.append(p)
            if p["kind"] in STUDDED:
                for c in cells_of(p):
                    tops[c] = (idx0 + i, y + p["h"])
            else:
                for c in cells_of(p):
                    tops.pop(c, None)
        layer_parts.append(list(range(idx0, len(all_parts))))
        y += h
    return all_parts, layer_parts


def cells_of(p):
    return [(p["x"] + i, p["z"] + j) for i in range(p["w"]) for j in range(p["d"])]


# ---------------------------------------------------------------- steps
MAX_PER_STEP = 7


def make_steps(parts, layer_parts):
    steps = []
    shoulder = max(i for i, l in enumerate(LAYERS) if l["name"] == "shoulders")
    arm_layers = sorted({parts[i]["layer"] for lp in layer_parts for i in lp if parts[i]["tag"] in ARM_TAGS},
                        reverse=True)
    for li, lp in enumerate(layer_parts):
        body = [i for i in lp if parts[i]["tag"] == "body"]
        # big layers split into two steps: back half first so the new parts stay visible
        body.sort(key=lambda i: (-parts[i]["z"], parts[i]["x"]))
        n = max(1, -(-len(body) // MAX_PER_STEP))
        size = -(-len(body) // n)
        for k in range(n):
            chunk = body[k * size:(k + 1) * size]
            if chunk:
                steps.append({"parts": chunk, "label": LAYERS[li]["name"]})
        if li == shoulder:
            for tags, label in (({"armL", "armR"}, "arms"), ({"pack"}, "backpack")):
                for al in arm_layers:
                    chunk = [i for i in layer_parts[al] if parts[i]["tag"] in tags]
                    if chunk:
                        steps.append({"parts": chunk, "label": label, "fromBelow": True})
    for s, st in enumerate(steps):
        for i in st["parts"]:
            parts[i]["step"] = s
    return steps


# ---------------------------------------------------------------- checks
def check(parts, steps):
    report = {}
    occ = {}
    collisions = 0
    for i, p in enumerate(parts):
        for (x, z) in cells_of(p):
            for yy in range(p["y"], p["y"] + p["h"]):
                if (x, yy, z) in occ:
                    collisions += 1
                occ[(x, yy, z)] = i
    report["collisions"] = collisions

    # stud connections: every stud of a lower studded part that sits inside an upper part's footprint
    top_of = {}
    for i, p in enumerate(parts):
        for c in cells_of(p):
            top_of[(c[0], p["y"] + p["h"], c[1])] = i
    links = defaultdict(int)
    for j, p in enumerate(parts):
        for (x, z) in cells_of(p):
            i = top_of.get((x, p["y"], z))
            if i is not None and parts[i]["kind"] in STUDDED:
                links[(min(i, j), max(i, j))] += 1
    report["connections"] = sum(links.values())
    nbrs = defaultdict(set)
    for (a, b) in links:
        nbrs[a].add(b)
        nbrs[b].add(a)

    # one connected structure
    seen, stack = {0}, [0]
    while stack:
        for n in nbrs[stack.pop()]:
            if n not in seen:
                seen.add(n)
                stack.append(n)
    report["connected"] = len(seen) == len(parts)
    report["floating"] = [i for i in range(len(parts)) if i not in seen]

    # parts held by a single stud are weak points
    studs_per_part = defaultdict(int)
    for (a, b), n in links.items():
        studs_per_part[a] += n
        studs_per_part[b] += n
    report["single_stud_parts"] = sum(1 for i in range(len(parts)) if studs_per_part[i] <= 1)

    # buildability: in order, each part must clip onto something already built, and be pushed
    # on from a free direction (down onto studs with nothing above, or up from below with nothing below)
    placed = set()
    problems = []
    step_com = []
    for s, st in enumerate(steps):
        pending = list(st["parts"])
        while pending:
            progress = False
            for i in list(pending):
                p = parts[i]
                below = {b for b in nbrs[i] if b in placed and parts[b]["y"] < p["y"]}
                above = {a for a in nbrs[i] if a in placed and parts[a]["y"] > p["y"]}
                if p["y"] == 0 and not above:
                    ok = column_clear(i, parts, placed, occ, up=True)
                elif below and not above:
                    ok = column_clear(i, parts, placed, occ, up=True)
                elif above and not below:
                    ok = column_clear(i, parts, placed, occ, up=False)
                else:
                    ok = False
                if ok:
                    placed.add(i)
                    pending.remove(i)
                    progress = True
            if not progress:
                problems += [(s, i) for i in pending]
                placed.update(pending)
                break
        step_com.append(stability(parts, placed))
    report["build_problems"] = problems
    report["every_step_buildable"] = not problems
    report["com_margin_per_step"] = [round(m, 2) for m in step_com]
    report["stable_every_step"] = all(m > 0 for m in step_com)
    report["com_margin_final"] = round(step_com[-1], 2)
    return report


def column_clear(i, parts, placed, occ, up):
    p = parts[i]
    for (x, z) in cells_of(p):
        for (xx, yy, zz), j in occ.items():
            if xx == x and zz == z and j in placed and j != i:
                if up and yy >= p["y"] + p["h"]:
                    return False
                if not up and yy < p["y"]:
                    return False
    return True


def stability(parts, placed):
    """Distance (studs) from the centre of mass to the edge of the ground footprint's convex hull.
    Positive means the model stands."""
    m = mx = mz = 0.0
    for i in placed:
        p = parts[i]
        v = p["w"] * p["d"] * p["h"]
        m += v
        mx += v * (p["x"] + p["w"] / 2)
        mz += v * (p["z"] + p["d"] / 2)
    cx, cz = mx / m, mz / m
    pts = []
    for i in placed:
        p = parts[i]
        if p["y"] == 0:
            pts += [(p["x"], p["z"]), (p["x"] + p["w"], p["z"]), (p["x"], p["z"] + p["d"]),
                    (p["x"] + p["w"], p["z"] + p["d"])]
    hull = convex_hull(pts)
    dmin = float("inf")
    for k in range(len(hull)):
        (ax, az), (bx, bz) = hull[k], hull[(k + 1) % len(hull)]
        ex, ez = bx - ax, bz - az
        cross = ex * (cz - az) - ez * (cx - ax)  # >0 inside for counter-clockwise hull
        dmin = min(dmin, cross / (ex * ex + ez * ez) ** 0.5)
    return dmin


def convex_hull(pts):
    pts = sorted(set(pts))
    if len(pts) <= 2:
        return pts

    def half(seq):
        h = []
        for p in seq:
            while len(h) >= 2 and ((h[-1][0] - h[-2][0]) * (p[1] - h[-2][1]) -
                                   (h[-1][1] - h[-2][1]) * (p[0] - h[-2][0])) <= 0:
                h.pop()
            h.append(p)
        return h

    lo, hi = half(pts), half(reversed(pts))
    return lo[:-1] + hi[:-1]


# ---------------------------------------------------------------- export
def ldraw(parts, steps, title):
    out = [f"0 {title}", "0 Name: robot.ldr", "0 Author: Claude Opus 5.5", "0 !LDRAW_ORG Unofficial_Model", ""]
    for st in steps:
        for i in st["parts"]:
            p = parts[i]
            X = (p["x"] + p["w"] / 2) * 20
            Z = (p["z"] + p["d"] / 2) * 20
            Y = -(p["y"] + p["h"]) * 8
            m = "0 0 1 0 1 0 -1 0 0" if p["rot"] else "1 0 0 0 1 0 0 0 1"
            out.append(f"1 {p['color']} {X:g} {Y:g} {Z:g} {m} {p['id']}.dat")
        out.append("0 STEP")
    return "\n".join(out) + "\n"


def inventory(parts, idxs=None):
    counts = defaultdict(int)
    for i in (range(len(parts)) if idxs is None else idxs):
        p = parts[i]
        counts[(p["id"], p["color"])] += 1
    rows = []
    for (pid, color), n in counts.items():
        ex = next(p for p in parts if p["id"] == pid and p["color"] == color)
        rows.append({"id": pid, "name": ex["name"], "kind": ex["kind"], "w": max(ex["w"], ex["d"]),
                     "d": min(ex["w"], ex["d"]), "color": color, "colorName": COLORS[color][0], "count": n})
    rows.sort(key=lambda r: (r["kind"], r["colorName"], -r["w"] * r["d"]))
    return rows


def main():
    title = "Bolt the Brick Bot"
    parts, layer_parts = design()
    steps = make_steps(parts, layer_parts)
    report = check(parts, steps)
    for st in steps:
        st["inventory"] = inventory(parts, st["parts"])
    model = {
        "title": title,
        "parts": parts,
        "steps": steps,
        "inventory": inventory(parts),
        "colors": {str(k): {"name": v[0], "hex": v[1], "trans": v[0].startswith("Trans")} for k, v in COLORS.items()},
        "report": report,
    }
    with open("robot.ldr", "w") as f:
        f.write(ldraw(parts, steps, title))
    with open("model.js", "w") as f:
        f.write("export default " + json.dumps(model) + ";\n")

    size = [max(p["x"] + p["w"] for p in parts) - min(p["x"] for p in parts),
            max(p["z"] + p["d"] for p in parts) - min(p["z"] for p in parts),
            max(p["y"] + p["h"] for p in parts)]
    print(f"{title}: {len(parts)} parts, {len(steps)} steps, {len(model['inventory'])} unique part/colour lots")
    print(f"size: {size[0]} x {size[1]} studs, {size[2]} plates tall "
          f"({size[0] * 0.8:.1f} x {size[1] * 0.8:.1f} x {size[2] * 0.32:.1f} cm)")
    print(f"collisions:          {report['collisions']}")
    print(f"stud connections:    {report['connections']}")
    print(f"one connected piece: {report['connected']}  floating={report['floating']}")
    print(f"every step buildable:{report['every_step_buildable']}  problems={report['build_problems']}")
    print(f"stands at every step:{report['stable_every_step']}  final COM margin={report['com_margin_final']} studs")
    print(f"single-stud parts:   {report['single_stud_parts']}")


if __name__ == "__main__":
    main()
