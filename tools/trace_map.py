"""Turn the course's bird's-eye map into a class mask the game reads (assets/course-mask.png).

Usage: python3 tools/trace_map.py <course-map.png>

Each pixel of the output is a class code times 30:
0 park (trees), 1 light rough, 2 fairway/tees, 3 green collar, 4 green, 5 bunker, 6 road.
Hole numbers, the black hole lines and dots are painted out. Hole 6 is removed so the game can
draw it stretched to its scorecard length. Prints a fitted ellipse for each green.
"""
import sys, math
from collections import Counter, deque
from PIL import Image

src = Image.open(sys.argv[1]).convert("RGB")
W, H = src.size
px = src.load()
PAL = [((255, 255, 255), 0), ((199, 193, 147), 1), ((118, 121, 52), 2), ((140, 140, 57), 4),
       ((240, 219, 193), 5), ((135, 135, 135), 6), ((30, 30, 10), 9), ((39, 93, 197), 0)]
cls = [[0] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        r, g, b = px[x, y]
        cls[y][x] = min(PAL, key=lambda p: (p[0][0] - r) ** 2 + (p[0][1] - g) ** 2 + (p[0][2] - b) ** 2)[1]

def majority(x, y, rad, skip):
    c = Counter()
    for j in range(-rad, rad + 1):
        for i in range(-rad, rad + 1):
            if 0 <= x + i < W and 0 <= y + j < H and cls[y + j][x + i] not in skip:
                c[cls[y + j][x + i]] += 1
    return c.most_common(1)[0][0] if c else 0

def component(sx, sy, ok):
    seen, q, out = {(sx, sy)}, deque([(sx, sy)]), []
    while q:
        x, y = q.popleft(); out.append((x, y))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and ok(cls[n[1]][n[0]]):
                seen.add(n); q.append(n)
    return out

# hole number discs: fill from the ring just outside them
LABELS = [(671, 820), (628, 611), (595, 362), (319, 141), (437, 355), (432, 491), (159, 222), (111, 407), (830, 1040)]
for cx, cy in LABELS:
    ring = Counter()
    for a in range(72):
        for rr in (14, 15, 16):
            x, y = int(cx + rr * math.cos(a / 72 * 6.283)), int(cy + rr * math.sin(a / 72 * 6.283))
            if cls[y][x] not in (0, 9): ring[cls[y][x]] += 1
    fill = ring.most_common(1)[0][0] if ring else 1
    for y in range(cy - 13, cy + 14):
        for x in range(cx - 13, cx + 14):
            if (x - cx) ** 2 + (y - cy) ** 2 <= 13 * 13 and cls[y][x] in (0, 9): cls[y][x] = fill

# black lines and dots, and stray antialiased pixels: take the neighbours' class
for _ in range(3):
    for y in range(H):
        for x in range(W):
            if cls[y][x] == 9: cls[y][x] = majority(x, y, 2, (9,))

# specks: grey bits of the hole lines are not road, and tiny islands of anything are noise
seen_all = set()
for y in range(H):
    for x in range(W):
        k = cls[y][x]
        if k == 0 or (x, y) in seen_all: continue
        comp = component(x, y, lambda c, k=k: c == k)
        seen_all.update(comp)
        if (k == 6 and len(comp) < 400) or len(comp) < 25:
            for cx, cy in comp: cls[cy][cx] = 9
for _ in range(4):
    for y in range(H):
        for x in range(W):
            if cls[y][x] == 9: cls[y][x] = majority(x, y, 3, (9, 6))

# frame and anything outside the drawing is park
for y in range(H):
    for x in range(W):
        if x < 8 or y < 8 or x >= W - 8 or y >= H - 8: cls[y][x] = 0

# remove hole 6 (the game redraws it longer)
for x, y in component(440, 480, lambda k: k != 0): cls[y][x] = 0

# greens: only the light patches at the pins count; other light patches (tee boxes) become fairway
PINS = {1: (577, 808), 2: (795, 598), 3: (494, 313), 4: (290, 104), 5: (621, 548), 7: (106, 94), 8: (244, 556), 9: (905, 1133)}
greens = set()
for n, (gx, gy) in PINS.items():
    best = min(((x, y) for y in range(gy - 12, gy + 13) for x in range(gx - 12, gx + 13) if cls[y][x] == 4), key=lambda p: (p[0] - gx) ** 2 + (p[1] - gy) ** 2)
    comp = component(*best, lambda k: k == 4)
    greens |= set(comp)
    mx = sum(p[0] for p in comp) / len(comp); my = sum(p[1] for p in comp) / len(comp)
    sxx = sum((p[0] - mx) ** 2 for p in comp) / len(comp); syy = sum((p[1] - my) ** 2 for p in comp) / len(comp); sxy = sum((p[0] - mx) * (p[1] - my) for p in comp) / len(comp)
    tr, det = sxx + syy, sxx * syy - sxy * sxy
    l1 = tr / 2 + math.sqrt(max(0, tr * tr / 4 - det)); l2 = tr / 2 - math.sqrt(max(0, tr * tr / 4 - det))
    rot = 0.5 * math.atan2(2 * sxy, sxx - syy)
    print(f"hole {n}: green x {mx:.0f} y {my:.0f} rx {2 * math.sqrt(l1):.1f} ry {2 * math.sqrt(l2):.1f} rot {rot:.2f}")
for y in range(H):
    for x in range(W):
        if cls[y][x] == 4 and (x, y) not in greens: cls[y][x] = 2
# dark collar round each green
for y in range(H):
    for x in range(W):
        if cls[y][x] == 2 and any((x + i, y + j) in greens for i in (-8, 0, 8) for j in (-8, 0, 8)): cls[y][x] = 3

# tidy edges with a 3x3 majority filter
out = Image.new("L", (W, H))
o = out.load()
for y in range(H):
    for x in range(W):
        o[x, y] = majority(x, y, 1, ()) * 30
out.save("assets/course-mask.png", optimize=True)
print("saved", W, H)
