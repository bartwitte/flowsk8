# Handover — flowsk8 — 18 juli 2026

## Current status
v1 gebouwd, als PWA installeerbaar gemaakt en live op **https://bartwitte.github.io/flowsk8/**.
Repo: https://github.com/bartwitte/flowsk8 (publiek; Willems spec-document staat in .gitignore).

Werkt: filmen, clips opslaan met trick/obstakel/geland, bibliotheek met filters, trimmen
(Chrome: her-encoderen; iPhone/Safari: soft trim met knippunten — getest door captureStream
uit te schakelen), downloaden, camerahoek-tips, offline via service worker, app-iconen.

Sessieherstart halverwege de PWA-verbouwing: staat gecontroleerd, niets verloren gegaan.

## Open tasks
- [ ] Op Willems iPhone installeren (Safari → Deel → "Zet op beginscherm") en camera testen
- [ ] Feedback van Willem verwerken
- [ ] Ideeën voor later in tasks/todo.md (slow-motion, spots, delen, echte angle-analyse)

## Blocked
Nothing.

## Context for next session
Deploy: push naar main, dan `git subtree push --prefix app origin gh-pages`.
Bij wijzigingen aan app-bestanden: CACHE-versie in app/sw.js ophogen, anders zien
geïnstalleerde apps de update pas laat. GitHub-token kan geen Actions-workflows pushen
(geen workflow-scope) — daarom de gh-pages-route.
