# Royal Park Golf

A pixel-art golf game set on Royal Park Golf Course in Melbourne. It's a web app you can install on your phone (a PWA) and it works offline after the first visit.

**Play:** https://eccles-matt.github.io/royal-park-golf-game/ (once GitHub Pages is switched on)

## How to play

- **Aim:** drag the view left or right. The little hole map in the corner shows your line. Tap the map (or LOOK) to look down the hole.
- **Distance:** the ring and pole show where the shot lands at full power, or at the pin if it's in reach. Drag up or down to move it. The red notch on the meter is the power that lands there, so stop the meter on it for a ¾ or ½ shot.
- **Swing:** tap SWING three times: once to start, once to set power, and once on the line to hit it straight. Tapping early hooks it left. Tapping late slices it right.
- **Clubs:** the game picks one for the distance. Change it with the arrows.
- **Putting:** on the green, drag down on the putt pad and let go. The dotted line shows where the putt will roll, and the specks drifting across the green show which way it slopes.
- **Keyboard:** Space swings, left/right aim, up/down set the distance, Q/E change clubs, and M looks ahead.

## Running it locally

There's no build step. Serve the folder with any static server, for example:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## How it's put together

| File | What it does |
| --- | --- |
| `src/course.js` | Hole data: tee, fairway path, green, bunkers, hills, and the bushland tree layout |
| `src/terrain.js` | Turns a hole into a height grid, surface grid and shaded colour grid |
| `src/render.js` | Draws the 288×216 view: heightmap terrain, sky, depth-sorted tree sprites, ball and markers |
| `src/sprites.js` | Pixel sprites for river red gums, soft gums and the flag |
| `src/physics.js` | Clubs, ball flight with drag, wind, curve, tree hits, bounce, and roll on slopes |
| `src/hud.js` | Clubhouse-style overlay: hole card, wind, hole map, club and swing meter |
| `src/main.js` | Game flow, swing meter, aiming and controls |
| `src/theme.js` | The golden-hour palette |
| `sw.js` | Offline support. Network first, cache as fallback, so installed copies pick up new deploys on their next launch |

Units are metres. x runs east and y runs south.

Hole 3 is currently a **test layout** (a made-up dogleg left). It will be replaced by the real hole once it has been traced.

## Credits

The font is Press Start 2P by CodeMan38, used under the SIL Open Font License (`fonts/OFL.txt`).
