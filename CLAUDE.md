# flowsk8

## What is this?
Skate-app voor Willem Witte. Spec komt uit `Flowsk8.pages` (Willems eigen woorden). De app moet:
skaters kunnen filmen, na afloop tips geven over een betere camerahoek, video's organiseren
per trick (bijv. kickflip, tre flip) en per obstakel (ledge, rail, ...), gelande tricks
("clean weggerold") apart markeren zodat je niet hoeft te scrollen, en je moet clips kunnen
editen (trimmen). Bovenal: het moet makkelijk zijn — Willem is een kind, de UI is Nederlands
en groot/simpel.

## Tech stack
- Vanilla JS (ES modules, geen framework, geen build-stap)
- HTML/CSS, opslag in IndexedDB (video-blobs blijven op het apparaat)
- Camera via getUserMedia + MediaRecorder, trimmen via captureStream + MediaRecorder

## Dev commands
```bash
# Lokaal draaien (camera werkt op localhost)
python3 -m http.server 8080 --directory app
# Open http://localhost:8080

# Deployen naar GitHub Pages (na commit op main)
git push origin main
git subtree push --prefix app origin gh-pages
# Live op https://bartwitte.github.io/flowsk8/
```

## Architecture
- `app/index.html` — één pagina met vier tabs: Filmen, Clips, Game, Tips
- `app/js/db.js` — IndexedDB-laag (clips: blob, trick, obstakel, geland, thumb)
- `app/js/camera.js` — opnemen + na opname trick/obstakel/geland invullen + unlock-melding
- `app/js/library.js` — cliplijst met filters (trick, obstakel, alleen geland)
- `app/js/editor.js` — trimmen (in/uit-punt, opnieuw opnemen via captureStream) + download
- `app/js/tips.js` — camerahoek-tips per obstakel
- `app/js/skills.js` — street skills uit gelande clips + requirement-checker (checkReq/describeReq)
- `app/js/gear.js` — gear-catalogus (deck/lagers/wielen/griptape), unlocks, setup, stats
- `app/js/game.js` — canvas skate-runner: levels met offline-bewijs, physics uit gear-stats
- `app/js/park3d.js` — Mega Skatepark in 3D (Three.js, vendored in app/lib): Brawl
  Stars-camera + virtuele joystick, rondlopende bot-skaters (Bram/Sanne/Pim) die je
  uitdaagt door tegen ze aan te lopen. Three.js laadt lazy bij het openen van het park.
- `app/js/skate.js` — game of SKATE: tricklist en landingskans uit echte clips
  (kans = 25 + 12×min(clips,5) + 25×(geland÷pogingen)); Willems regel: trick niet
  unlockt (nooit geland gefilmd) = automatisch een letter — geldt voor beide kanten.

## Game-concept (Willems idee)
Offline (street) skills unlocken de online game. Clips die "geland" gemarkeerd zijn tellen:
per trick, aantal clips, verschillende tricks, en obstakel (ledge/rail telt als grind).
Gear beïnvloedt de game-physics: deck→pop (springhoogte), lagers→snelheid, griptape→slipkans,
wielen→grip + hard/zacht af te stellen (hard = sneller maar slipperiger). Levels vereisen
naast het vorige level ook echt straatbewijs (bijv. level 3: land een kickflip of heelflip).

## Gotchas
- Camera en captureStream vereisen localhost of https.
- iPhone-bug: de camera-track kan tijdens opname wegvallen ("capture failure") — beeld
  bevriest, geluid loopt door. Mitigaties in camera.js: timeslice-opname (1s), wake lock,
  track-'ended'-waakhond die de opname netjes stopt + waarschuwing toont. Triggers:
  schermdimmen, telefoon draaien tijdens filmen, meldingen/app-wissel.
- Trimmen: Chrome her-encodeert via captureStream (duurt zo lang als de selectie);
  Safari/iPhone kan dat niet — daar slaan we knippunten op ("soft trim", ✂ op de kaart)
  en speelt de speler alleen de selectie af. Download geeft dan wel de hele video.
- PWA: service worker cachet de app-shell (sw.js); bij wijzigingen CACHE-versie ophogen.
  Precache fetcht met cache:'reload' — anders kan de sw oude HTTP-cache-kopieën insluiten.
- Lokaal testen: browser-memory-cache kan oude modules vasthouden ondanks sw/cache wissen;
  navigeer naar index.html?vers=x om vers te laden.
- Alles staat lokaal in IndexedDB — cache wissen = clips kwijt. Download belangrijke clips.
- Willems telefoon is een iPhone: installeren via Safari → Deel → "Zet op beginscherm".
- GitHub-token heeft geen `workflow`-scope: geen Actions-workflows pushen; deploy gaat
  via de gh-pages branch (subtree, zie Dev commands).
- `Flowsk8.pages` (Willems spec) staat bewust in .gitignore — repo is publiek.

## Git workflow
Repo: https://github.com/bartwitte/flowsk8 (publiek, main + feature branches,
Nederlandse commit-messages). Hosting: GitHub Pages vanaf de gh-pages branch.
