// Gear-catalogus: unlock je met street skills, bepaalt hoe je in de game presteert.
import { checkReq } from './skills.js';

export const GEAR = {
  deck: {
    label: 'Skateboard',
    items: [
      { id: 'leen', naam: 'Leen-deck', effect: 'Standaard pop', pop: 1.0, req: null },
      { id: 'street', naam: 'Street-deck', effect: 'Meer pop — spring hoger', pop: 1.15, req: { trick: 'ollie' } },
      { id: 'pro', naam: 'Pro-deck', effect: 'Maximale pop — spring het hoogst', pop: 1.3, req: { landed: 8, distinct: 3 } },
    ],
  },
  lagers: {
    label: 'Lagers',
    items: [
      { id: 'roest', naam: 'Roestige lagers', effect: 'Standaard snelheid', speed: 1.0, req: null },
      { id: 'abec5', naam: 'ABEC 5', effect: 'Sneller rollen', speed: 1.12, req: { landed: 3 } },
      { id: 'ceramic', naam: 'Ceramic lagers', effect: 'Veel sneller rollen', speed: 1.25, req: { landed: 10, distinct: 4 } },
    ],
  },
  wielen: {
    label: 'Wielen',
    items: [
      { id: 'stoep', naam: 'Stoepwielen', effect: 'Standaard grip', grip: 0, tune: false, req: null },
      { id: 'street', naam: 'Street-wielen', effect: 'Meer grip + hard/zacht af te stellen', grip: 0.03, tune: true, req: { anyTrick: ['kickflip', 'heelflip'] } },
      { id: 'pro', naam: 'Pro-wielen', effect: 'Maximale grip + hard/zacht af te stellen', grip: 0.05, tune: true, req: { grind: true } },
    ],
  },
  grip: {
    label: 'Griptape',
    items: [
      { id: 'kaal', naam: 'Kale griptape', effect: 'Glad — 8% slipkans', slip: 0.08, req: null },
      { id: 'ruw', naam: 'Ruwe griptape', effect: 'Grip — 4% slipkans', slip: 0.04, req: { landed: 5 } },
      { id: 'death', naam: 'Death grip', effect: 'Plakt — 1% slipkans', slip: 0.01, req: { distinct: 4 } },
    ],
  },
};

// Tricks in de game: unlock je door ze in het echt te landen.
export const GAME_TRICKS = [
  { id: 'shove', naam: 'Pop shove-it', punten: 30, req: { trick: 'shove' }, key: 's' },
  { id: 'kickflip', naam: 'Kickflip', punten: 50, req: { trick: 'kickflip' }, key: 'k' },
  { id: 'heelflip', naam: 'Heelflip', punten: 50, req: { trick: 'heelflip' }, key: 'h' },
  { id: 'treflip', naam: 'Tre flip', punten: 100, req: { trick: 'tre' }, key: 't' },
];

const SETUP_KEY = 'flowsk8-setup';

export function getSetup() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SETUP_KEY)) || {}; } catch { /* leeg */ }
  return {
    deck: s.deck || 'leen',
    lagers: s.lagers || 'roest',
    wielen: s.wielen || 'stoep',
    grip: s.grip || 'kaal',
    hardheid: s.hardheid || 'zacht',
  };
}

export function saveSetup(setup) {
  localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
}

export function itemById(cat, id) {
  return GEAR[cat].items.find(i => i.id === id) || GEAR[cat].items[0];
}

export function isUnlocked(item, skills) {
  return checkReq(item.req, skills);
}

// Valideer de setup tegen wat echt geunlockt is (val terug op standaard-item).
export function validSetup(skills) {
  const s = getSetup();
  for (const cat of Object.keys(GEAR)) {
    if (!isUnlocked(itemById(cat, s[cat]), skills)) s[cat] = GEAR[cat].items[0].id;
  }
  return s;
}

// Game-stats uit de setup. Harde wielen: sneller maar slipperiger; zachte: andersom.
export function computeStats(setup) {
  const deck = itemById('deck', setup.deck);
  const lagers = itemById('lagers', setup.lagers);
  const wielen = itemById('wielen', setup.wielen);
  const grip = itemById('grip', setup.grip);
  const hard = wielen.tune && setup.hardheid === 'hard';
  const zacht = wielen.tune && setup.hardheid === 'zacht';
  return {
    pop: deck.pop,
    speed: lagers.speed * (hard ? 1.08 : 1) * (zacht ? 0.97 : 1),
    slip: Math.max(0.005, grip.slip - wielen.grip + (hard ? 0.02 : 0) - (zacht ? 0.01 : 0)),
  };
}

// Alles wat je kunt unlocken (voor de skills-lijst en de "nieuw unlocked"-melding).
export function allUnlocks(skills) {
  const list = [];
  for (const [cat, group] of Object.entries(GEAR)) {
    for (const item of group.items) {
      if (item.req) list.push({ soort: group.label, naam: item.naam, effect: item.effect, req: item.req, unlocked: isUnlocked(item, skills) });
    }
  }
  for (const t of GAME_TRICKS) {
    list.push({ soort: 'Game-trick', naam: t.naam, effect: `${t.punten} punten in de lucht`, req: t.req, unlocked: checkReq(t.req, skills) });
  }
  return list;
}
