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
```

## Architecture
- `app/index.html` — één pagina met drie tabs: Filmen, Clips, Tips
- `app/js/db.js` — IndexedDB-laag (clips: blob, trick, obstakel, geland, thumb)
- `app/js/camera.js` — opnemen + na opname trick/obstakel/geland invullen
- `app/js/library.js` — cliplijst met filters (trick, obstakel, alleen geland)
- `app/js/editor.js` — trimmen (in/uit-punt, opnieuw opnemen via captureStream) + download
- `app/js/tips.js` — camerahoek-tips per obstakel

## Gotchas
- Camera en captureStream vereisen localhost of https; richt op Chrome (Safari's
  video.captureStream is beperkt).
- Trimmen her-encodeert door de selectie af te spelen; duurt even zo lang als de selectie.
- Alles staat lokaal in IndexedDB — cache wissen = clips kwijt. Download belangrijke clips.

## Git workflow
Nog geen git-repo. Bij init: main + feature branches, Nederlandse commit-messages.
