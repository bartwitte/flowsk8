# Handover — flowsk8 — 18 juli 2026

## Current status
v1 gebouwd en getest in de browser. De spec komt uit `Flowsk8.pages` (Willems wensen).
Werkt: filmen (camera + opname), clips opslaan met trick/obstakel/geland, bibliotheek met
filters (trick, obstakel, alleen geland), trimmen + downloaden, camerahoek-tips (per
obstakel + tip na elke opname). UI is Nederlands, donker skate-thema, mobiel-eerst.

Getest via de Browser pane met synthetische testclips (daarna weer verwijderd): bibliotheek,
filters, speler, trimmen en tips-tab werken. Camera-opname zelf kon in de test-pane niet
(permissies geblokkeerd) — de foutmelding + "Opnieuw proberen" werkt wel. Nog testen op
echte localhost/telefoon.

## Open tasks
- [ ] Camera-opname testen op echt apparaat (Chrome, localhost of https)
- [ ] Aan Willem laten zien; feedback verwerken
- [ ] Ideeën voor later staan in tasks/todo.md (slow-motion, spots, delen, echte angle-analyse)

## Blocked
Nothing.

## Context for next session
Start met CLAUDE.md. App draaien: `python3 -m http.server 8080 --directory app` en open
http://localhost:8080. Geen git-repo — overweeg `git init` bij de volgende sessie.
