# Royal Park Golf

A pixel-art golf game set on Royal Park Public Golf Course in Melbourne: all 9 holes, par 35, 2316 yards. It's a web app you can install on your phone (a PWA) and it works offline after the first visit.

**Play:** https://eccles-matt.github.io/royal-park-golf-game/ (once GitHub Pages is switched on)

## How to play

Tee off from the title screen to play the 9 holes in order. Your scorecard shows after each hole, and a round in progress is remembered if you close the app between holes. To try a single hole, tap its number under **Practise one hole**, or open the game with `?hole=5` on the end of the link.

The game fills the whole screen.

- **Aim:** touch anywhere except the ball and drag left or right. The hole map in the corner shows your line. Tap the map (LOOK) to look down the hole.
- **Distance:** the ring and pole show where the shot lands at full power, or at the pin if it's in reach. Drag up or down away from the ball to move it. The red line on the power gauge marks the power that lands there, so you can play a ¾ or ½ shot.
- **Swing:** put your finger on the ball (the dotted ring) and pull back to set power, then flick up quickly. Touches that miss the ball only aim. Letting go without a flick does nothing. Flicking straight up hits it straight. Flick up and to the left to hook it left, and up and to the right to slice it right. The wider the angle, the bigger the curve.
- **Clubs:** the game picks one for the distance. Tap the arrows on the club card to change it.
- **Putting:** like a slingshot. Touch the ball, pull back and let go. The further you pull, the harder the putt, and pulling off to one side sends it the other way. A dotted line shows how it will roll and break. Hit it too hard and it can lip out. The light streaks drifting across the green show which way it slopes.
- **Keyboard:** hold Space to build power and release to hit. Left/right aim, up/down set the distance, Q/E change clubs, and M looks ahead.

## Running it locally

There's no build step. Serve the folder with any static server, for example:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## How it's put together

| File | What it does |
| --- | --- |
| `src/course.js` | The course: tees, pins, green shapes and slopes, hills, fences, the cliff on the 2nd, and where the gums grow |
| `assets/course-mask.png` | The course's bird's-eye map traced into surfaces: fairway, light rough, greens, bunkers, roads, parkland |
| `tools/trace_map.py` | Makes `course-mask.png` from the map image (`python3 tools/trace_map.py map.png`) |
| `src/terrain.js` | Turns the whole park into one height grid, surface grid and shaded colour grid |
| `src/render.js` | Draws the 288×216 view: heightmap terrain, sky, depth-sorted tree sprites, ball and markers |
| `src/sprites.js` | Pixel sprites for river red gums, soft gums and the flag |
| `src/physics.js` | Clubs, ball flight with drag, wind, curve, tree hits, bounce, and roll on slopes |
| `src/hud.js` | Clubhouse-style overlay: hole card, wind, hole map, club and swing meter |
| `src/main.js` | Game flow, swing meter, aiming and controls |
| `src/theme.js` | The golden-hour palette |
| `sw.js` | Offline support. Network first, cache as fallback, so installed copies pick up new deploys on their next launch |

Units are metres. x runs east and y runs south, with north up as on the course map (so the city skyline sits to the south). All nine holes share one world, so you can see the neighbouring holes and their flags. The map draws the 6th shorter than its 145 yards, so that hole is stretched in `src/course.js`.

## Credits

The font is Press Start 2P by CodeMan38, used under the SIL Open Font License (`fonts/OFL.txt`).
