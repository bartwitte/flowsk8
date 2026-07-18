# Handover — flowsk8 — 18 juli 2026

## Current status
v2: game toegevoegd. Live op **https://bartwitte.github.io/flowsk8/**.
Repo: https://github.com/bartwitte/flowsk8 (publiek; Willems spec-document staat in .gitignore).

v1 werkt: filmen, clips met trick/obstakel/geland, filters, trimmen (iPhone: soft trim),
downloaden, tips, PWA (offline, installeerbaar).

v2 (Willems game-idee): street skills (gelande clips) unlocken gear en levels in een
canvas skate-runner. Gear stuurt de physics (deck→pop, lagers→snelheid, griptape→slipkans,
wielen hard/zacht). Levels 3-5 vereisen echt straatbewijs. Getest in de browser met
seed-clips: unlocks, setup, levelpoorten en de runner werken; testdata weer gewist.
Let op: gameloop heeft een timer-fallback omdat rAF in de test-pane niet vuurt.

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
