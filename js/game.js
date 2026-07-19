// De "online" kant: een skate-runner waarin je gear en levels unlockt
// met street skills (echt gelande, gefilmde tricks).
import { getStreetSkills, checkReq, describeReq } from './skills.js';
import { GEAR, GAME_TRICKS, getSetup, saveSetup, itemById, isUnlocked, validSetup, computeStats } from './gear.js';
import { initPark, enterPark, leavePark } from './park3d.js';

export const LEVELS = [
  { nr: 1, naam: 'Parkeerplaats', doel: 300, obstakels: ['pylon'], speedMult: 1.0, req: null },
  { nr: 2, naam: 'Schoolplein', doel: 500, obstakels: ['pylon', 'ledge'], speedMult: 1.05, req: { landed: 1 } },
  { nr: 3, naam: 'Skatepark', doel: 700, obstakels: ['pylon', 'ledge', 'rail'], speedMult: 1.12, req: { anyTrick: ['kickflip', 'heelflip'] } },
  { nr: 4, naam: 'Centrum', doel: 1000, obstakels: ['pylon', 'ledge', 'rail', 'trap'], speedMult: 1.2, req: { landed: 5, distinct: 3 } },
  { nr: 5, naam: 'Legendarische spot', doel: 1500, obstakels: ['ledge', 'rail', 'trap', 'container'], speedMult: 1.3, req: { grind: true } },
];

const OBSTAKELS = {
  pylon: { w: 22, h: 32, kleur: '#ff8c42' },
  ledge: { w: 90, h: 48, kleur: '#8a8a95' },
  rail: { w: 110, h: 58, kleur: '#ffd60a' },
  trap: { w: 120, h: 60, kleur: '#6a6a75' },
  container: { w: 140, h: 95, kleur: '#b0413e' },
};

const PROGRESS_KEY = 'flowsk8-level';
const getProgress = () => parseInt(localStorage.getItem(PROGRESS_KEY) || '0', 10);
const setProgress = n => localStorage.setItem(PROGRESS_KEY, String(Math.max(getProgress(), n)));

let skills = null;
let els = {};

// ---------- Engine ----------
const W = 640, H = 360, GROUND = 316, GRAV = 1400, PX_PER_M = 10;
let game = null; // actieve run
let rafId = 0;
let timerId = 0;

// rAF als het scherm zichtbaar is; timer-fallback als de browser rAF pauzeert
function schedule() {
  if (document.hidden) timerId = setTimeout(() => loop(performance.now()), 1000 / 30);
  else rafId = requestAnimationFrame(loop);
}

function unschedule() {
  cancelAnimationFrame(rafId);
  clearTimeout(timerId);
}

function newRun(level) {
  const stats = computeStats(validSetup(skills));
  return {
    level, stats,
    x: 0, speed: 230 * stats.speed * level.speedMult,
    y: GROUND, vy: 0, onGround: true,
    trick: null, // {def, t}
    lives: 3, score: 0, combo: 0,
    obstacles: [], nextSpawn: 500,
    invincible: 0, slipFx: 0, toasts: [], klaar: false, over: false,
    last: performance.now(),
  };
}

function jump() {
  if (!game || game.klaar || game.over) return;
  if (game.onGround) {
    game.vy = -430 * game.stats.pop;
    game.onGround = false;
  }
}

function doTrick(def) {
  if (!game || game.onGround || game.trick || game.klaar || game.over) return;
  game.trick = { def, t: 0, dur: 0.35 };
}

function toast(g, tekst, kleur) {
  g.toasts.push({ tekst, kleur, t: 0 });
}

function bail(g) {
  if (g.invincible > 0) return;
  g.lives -= 1;
  g.combo = 0;
  g.trick = null;
  g.y = GROUND; g.vy = 0; g.onGround = true;
  g.invincible = 1.2;
  toast(g, 'BAIL!', '#ff5c5c');
  if (g.lives <= 0) g.over = true;
}

function step(g, dt) {
  if (g.klaar || g.over) return;
  g.x += g.speed * dt;
  g.score += (g.speed * dt) / 25;
  g.invincible = Math.max(0, g.invincible - dt);
  g.slipFx = Math.max(0, g.slipFx - dt);

  // springen/zwaartekracht
  if (!g.onGround) {
    g.vy += GRAV * dt;
    g.y += g.vy * dt;
    if (g.trick) {
      g.trick.t += dt;
      if (g.trick.t >= g.trick.dur) {
        const punten = Math.round(g.trick.def.punten * (1 + g.combo * 0.1));
        g.score += punten;
        g.combo += 1;
        toast(g, `${g.trick.def.naam} +${punten}`, '#3ddc84');
        g.trick = null;
      }
    }
    if (g.y >= GROUND) {
      g.y = GROUND; g.vy = 0; g.onGround = true;
      if (g.trick) { // te vroeg geland midden in een trick
        g.trick = null;
        bail(g);
      } else if (Math.random() < g.stats.slip) {
        g.combo = 0;
        g.slipFx = 0.6;
        g.speed *= 0.995; // heel klein beetje vaart kwijt
        toast(g, 'SLIP!', '#ff8c42');
      }
    }
  }

  // obstakels spawnen
  if (g.x + W > g.nextSpawn) {
    const type = g.level.obstakels[Math.floor(Math.random() * g.level.obstakels.length)];
    g.obstacles.push({ type, x: g.nextSpawn, ...OBSTAKELS[type] });
    g.nextSpawn += 260 + Math.random() * 240 + g.speed * 0.25;
  }
  g.obstacles = g.obstacles.filter(o => o.x + o.w > g.x - 50);

  // botsen: speler staat op scherm-x 120, hitbox ~46 breed
  const px = g.x + 120, pw = 46;
  for (const o of g.obstacles) {
    const overlap = px + pw / 2 > o.x && px - pw / 2 < o.x + o.w;
    if (overlap && g.y > GROUND - o.h) { bail(g); o.x = -9999; break; }
  }

  // gehaald?
  if (g.x >= g.level.doel * PX_PER_M) {
    g.klaar = true;
    setProgress(g.level.nr);
  }

  g.toasts.forEach(t => { t.t += dt; });
  g.toasts = g.toasts.filter(t => t.t < 1.2);
}

function draw(g) {
  const ctx = els.canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  // lucht + grond
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#16161d'); grad.addColorStop(1, '#101014');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2c2c35'; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#ffd60a'; ctx.fillRect(0, GROUND, W, 3);
  // stoeptegels die meebewegen
  ctx.strokeStyle = '#3a3a45'; ctx.lineWidth = 2;
  for (let sx = -(g.x % 80); sx < W; sx += 80) {
    ctx.beginPath(); ctx.moveTo(sx, GROUND + 8); ctx.lineTo(sx - 12, H); ctx.stroke();
  }
  // obstakels
  for (const o of g.obstacles) {
    const sx = o.x - g.x;
    if (sx > W || sx + o.w < 0) continue;
    ctx.fillStyle = o.kleur;
    if (o.type === 'pylon') {
      ctx.beginPath();
      ctx.moveTo(sx + o.w / 2, GROUND - o.h);
      ctx.lineTo(sx + o.w, GROUND); ctx.lineTo(sx, GROUND);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(sx + 4, GROUND - o.h * 0.45, o.w - 8, 5);
    } else if (o.type === 'rail') {
      ctx.fillRect(sx, GROUND - o.h, o.w, 6);
      ctx.fillStyle = '#8a8a95';
      ctx.fillRect(sx + 6, GROUND - o.h + 6, 6, o.h - 6);
      ctx.fillRect(sx + o.w - 12, GROUND - o.h + 6, 6, o.h - 6);
    } else if (o.type === 'trap') {
      const treden = 4;
      for (let i = 0; i < treden; i++) {
        const th = (o.h / treden) * (treden - i);
        ctx.fillRect(sx + (o.w / treden) * i, GROUND - th, o.w / treden + 1, th);
      }
    } else {
      ctx.fillRect(sx, GROUND - o.h, o.w, o.h);
      if (o.type === 'container') {
        ctx.strokeStyle = '#7d2e2c';
        for (let i = 1; i < 5; i++) {
          ctx.beginPath(); ctx.moveTo(sx + (o.w / 5) * i, GROUND - o.h); ctx.lineTo(sx + (o.w / 5) * i, GROUND); ctx.stroke();
        }
      }
    }
  }
  // skater (knipperen bij invincible)
  if (g.invincible === 0 || Math.floor(g.invincible * 10) % 2 === 0) {
    const px = 120, py = g.y;
    ctx.save();
    ctx.translate(px, py);
    if (g.trick) ctx.rotate(Math.sin((g.trick.t / g.trick.dur) * Math.PI) * 0.9);
    // board
    ctx.fillStyle = g.slipFx > 0 ? '#ff8c42' : '#1a1a21';
    ctx.strokeStyle = '#f2f2f5'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-26, -8, 52, 7, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath(); ctx.arc(-15, 1, 5, 0, 7); ctx.arc(15, 1, 5, 0, 7); ctx.fill();
    ctx.restore();
    // figuurtje
    ctx.strokeStyle = '#f2f2f5'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const hurk = g.onGround ? 0 : 8;
    ctx.beginPath();
    ctx.moveTo(px - 8, py - 10); ctx.lineTo(px - 3, py - 26 + hurk);
    ctx.moveTo(px + 8, py - 10); ctx.lineTo(px + 3, py - 26 + hurk);
    ctx.moveTo(px, py - 26 + hurk); ctx.lineTo(px, py - 44 + hurk);
    ctx.moveTo(px, py - 40 + hurk); ctx.lineTo(px - 12, py - 30 + hurk);
    ctx.moveTo(px, py - 40 + hurk); ctx.lineTo(px + 12, py - 30 + hurk);
    ctx.stroke();
    ctx.fillStyle = '#f2f2f5';
    ctx.beginPath(); ctx.arc(px, py - 50 + hurk, 7, 0, 7); ctx.fill();
  }
  // zwevende teksten
  ctx.textAlign = 'center'; ctx.font = '900 22px -apple-system, sans-serif';
  for (const t of g.toasts) {
    ctx.globalAlpha = 1 - t.t / 1.2;
    ctx.fillStyle = t.kleur;
    ctx.fillText(t.tekst, 160, g.y - 70 - t.t * 40);
    ctx.globalAlpha = 1;
  }
  // finishvlag in zicht?
  const finishX = g.level.doel * PX_PER_M - g.x + 120;
  if (finishX < W) {
    ctx.fillStyle = '#3ddc84';
    ctx.fillRect(finishX, GROUND - 90, 5, 90);
    ctx.beginPath();
    ctx.moveTo(finishX + 5, GROUND - 90); ctx.lineTo(finishX + 45, GROUND - 78); ctx.lineTo(finishX + 5, GROUND - 66);
    ctx.fill();
  }
}

function hud(g) {
  els.hud.innerHTML =
    `<span>❤️ ${g.lives}</span>` +
    `<span>${Math.floor(g.x / PX_PER_M)} / ${g.level.doel} m</span>` +
    `<span>⭐ ${Math.floor(g.score)}</span>` +
    (g.combo > 1 ? `<span class="combo">🔥 x${g.combo}</span>` : '');
}

function loop(now) {
  if (!game) return;
  const dt = Math.min(0.05, (now - game.last) / 1000);
  game.last = now;
  step(game, dt);
  draw(game);
  hud(game);
  if (game.klaar || game.over) { endRun(); return; }
  schedule();
}

function startRun(level) {
  game = newRun(level);
  els.stage.classList.remove('hidden');
  els.levelList.classList.add('hidden');
  els.einde.classList.add('hidden');
  renderTrickButtons();
  game.last = performance.now();
  unschedule();
  schedule();
}

function endRun() {
  unschedule();
  const g = game;
  const volgende = LEVELS.find(l => l.nr === g.level.nr + 1);
  let sub = '';
  if (g.klaar && volgende) {
    sub = checkReq(volgende.req, skills)
      ? `Level ${volgende.nr} (${volgende.naam}) is open!`
      : `Voor level ${volgende.nr}: <b>${describeReq(volgende.req)}</b> — ga naar buiten, film het en markeer het geland! 🎥`;
  } else if (g.klaar) {
    sub = 'Je hebt alle levels gehaald. Legende! 🏆';
  }
  els.einde.innerHTML = `
    <h2>${g.klaar ? '🏁 Level gehaald!' : '💥 Game over'}</h2>
    <p class="einde-score">⭐ ${Math.floor(g.score)} punten</p>
    ${sub ? `<p class="einde-sub">${sub}</p>` : ''}
    <div class="row">
      <button class="btn primary" id="einde-opnieuw">${g.klaar ? 'Nog een keer' : 'Opnieuw'}</button>
      <button class="btn ghost" id="einde-terug">Naar levels</button>
    </div>`;
  els.einde.classList.remove('hidden');
  document.getElementById('einde-opnieuw').addEventListener('click', () => startRun(g.level));
  document.getElementById('einde-terug').addEventListener('click', stopGame);
  game = null;
}

export function stopGame() {
  unschedule();
  game = null;
  if (els.stage) {
    els.stage.classList.add('hidden');
    els.levelList.classList.remove('hidden');
    renderLevels();
  }
}

// ---------- UI ----------
function levelStatus(level) {
  if (level.nr > getProgress() + 1) return { open: false, tekst: `Haal eerst level ${level.nr - 1}` };
  if (!checkReq(level.req, skills)) return { open: false, tekst: `Street skill nodig: ${describeReq(level.req)}`, street: true };
  return { open: true };
}

function renderLevels() {
  els.levelList.innerHTML = '';
  for (const level of LEVELS) {
    const st = levelStatus(level);
    const gehaald = getProgress() >= level.nr;
    const card = document.createElement('button');
    card.className = 'level-card' + (st.open ? '' : ' locked');
    card.innerHTML = `
      <span class="level-nr">${gehaald ? '✅' : st.open ? '▶' : '🔒'}</span>
      <span class="level-info">
        <b>Level ${level.nr} — ${level.naam}</b>
        <small>${st.open || gehaald ? `${level.doel} m` : st.tekst}</small>
      </span>`;
    if (st.open) card.addEventListener('click', () => startRun(level));
    else if (st.street) card.addEventListener('click', () => alert(`Dit level unlock je op straat!\n\n${describeReq(level.req)}.\n\nFilm het, markeer het geland, en dit level gaat open. 🛹`));
    els.levelList.appendChild(card);
  }
}

function renderTrickButtons() {
  els.trickBtns.innerHTML = '';
  const open = GAME_TRICKS.filter(t => checkReq(t.req, skills));
  if (!open.length) {
    els.trickBtns.innerHTML = '<p class="trick-hint">Land tricks op straat om ze hier te unlocken! Nu: alleen ollie.</p>';
    return;
  }
  for (const t of open) {
    const b = document.createElement('button');
    b.className = 'btn trick-btn';
    b.textContent = t.naam;
    b.addEventListener('pointerdown', e => { e.preventDefault(); doTrick(t); });
    els.trickBtns.appendChild(b);
  }
}

function renderSetup() {
  const setup = validSetup(skills);
  const stats = computeStats(setup);
  const wielen = itemById('wielen', setup.wielen);
  let html = `
    <div class="stats-bars">
      ${statBar('Pop (springhoogte)', (stats.pop - 1) / 0.3)}
      ${statBar('Snelheid', (stats.speed - 0.95) / 0.45)}
      ${statBar('Grip', 1 - (stats.slip - 0.005) / 0.095)}
    </div>`;
  for (const [cat, group] of Object.entries(GEAR)) {
    html += `<h3 class="gear-kop">${group.label}</h3><div class="chips" data-cat="${cat}">`;
    for (const item of group.items) {
      const open = isUnlocked(item, skills);
      html += `<button class="chip gear-chip ${setup[cat] === item.id ? 'active' : ''} ${open ? '' : 'locked'}"
        data-id="${item.id}" ${open ? '' : 'disabled'}
        title="${open ? item.effect : describeReq(item.req)}">
        ${open ? '' : '🔒 '}${item.naam}</button>`;
      if (!open) html += `<small class="gear-req">↳ ${describeReq(item.req)}</small>`;
    }
    html += '</div>';
    if (cat === 'wielen' && wielen.tune) {
      html += `<div class="chips" data-cat="hardheid">
        <button class="chip ${setup.hardheid === 'zacht' ? 'active' : ''}" data-id="zacht">Zacht — meer grip</button>
        <button class="chip ${setup.hardheid === 'hard' ? 'active' : ''}" data-id="hard">Hard — sneller, minder grip</button>
      </div>`;
    }
  }
  els.setup.innerHTML = html;
  els.setup.querySelectorAll('.chips').forEach(group => {
    group.querySelectorAll('.chip:not(.locked)').forEach(chip => {
      chip.addEventListener('click', () => {
        const s = validSetup(skills);
        s[group.dataset.cat] = chip.dataset.id;
        saveSetup(s);
        renderSetup();
      });
    });
  });
}

function statBar(label, frac) {
  const pct = Math.round(Math.max(0.06, Math.min(1, frac)) * 100);
  return `<div class="stat-bar"><span>${label}</span><div class="bar"><div style="width:${pct}%"></div></div></div>`;
}

function renderSkills() {
  const trickRows = Object.entries(skills.byTrick)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `<li><b>${t}</b> — ${n}× clean geland</li>`).join('');
  const unlocks = [];
  for (const [cat, group] of Object.entries(GEAR)) {
    for (const item of group.items) {
      if (item.req) unlocks.push({ soort: group.label, naam: item.naam, effect: item.effect, req: item.req, open: isUnlocked(item, skills) });
    }
  }
  for (const t of GAME_TRICKS) unlocks.push({ soort: 'Game-trick', naam: t.naam, effect: `${t.punten} punten`, req: t.req, open: checkReq(t.req, skills) });
  for (const l of LEVELS) {
    if (l.req) unlocks.push({ soort: 'Level', naam: `${l.nr} — ${l.naam}`, effect: `${l.doel} m`, req: l.req, open: checkReq(l.req, skills) });
  }
  const teDoen = unlocks.filter(u => !u.open);
  els.skills.innerHTML = `
    <div class="skill-totalen">
      <div><b>${skills.landedCount}</b><span>clips geland</span></div>
      <div><b>${skills.distinct.length}</b><span>verschillende tricks</span></div>
      <div><b>${getProgress()}</b><span>levels gehaald</span></div>
    </div>
    ${trickRows ? `<h3 class="gear-kop">Jouw street tricks</h3><ul class="trick-lijst">${trickRows}</ul>` : ''}
    <h3 class="gear-kop">Nog te unlocken — ga skaten! 🎥</h3>
    ${teDoen.length ? teDoen.map(u => `
      <div class="unlock-card">
        <b>${u.naam}</b> <small>(${u.soort} — ${u.effect})</small>
        <p>→ ${describeReq(u.req)}</p>
      </div>`).join('') : '<p class="empty">Alles geunlockt. Jij bent klaar voor de Legendarische spot! 🏆</p>'}
    <button class="btn primary" id="skills-ga-filmen">🎥 Ga filmen</button>`;
  document.getElementById('skills-ga-filmen').addEventListener('click', () => {
    document.querySelector('.tabbar button[data-tab="filmen"]').click();
  });
}

function showMode(m) {
  stopGame();
  leavePark();
  document.getElementById('mode-kies').classList.toggle('hidden', !!m);
  document.getElementById('run-mode').classList.toggle('hidden', m !== 'run');
  document.getElementById('skate-battle').classList.add('hidden');
  if (m === 'run') renderLevels();
  if (m === 'park') enterPark(skills);
  else document.getElementById('park-mode').classList.add('hidden');
}

export async function refreshGame() {
  skills = await getStreetSkills();
  showMode(null);
  renderSetup();
  renderSkills();
}

export function initGame() {
  els = {
    canvas: document.getElementById('game-canvas'),
    hud: document.getElementById('game-hud'),
    stage: document.getElementById('game-stage'),
    levelList: document.getElementById('level-list'),
    trickBtns: document.getElementById('trick-buttons'),
    einde: document.getElementById('game-einde'),
    setup: document.getElementById('game-view-setup'),
    skills: document.getElementById('game-view-skills'),
  };
  els.canvas.width = W;
  els.canvas.height = H;

  // subtabs
  document.querySelectorAll('#game-nav .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#game-nav .chip').forEach(c => c.classList.toggle('active', c === chip));
      for (const view of ['spelen', 'setup', 'skills']) {
        document.getElementById(`game-view-${view}`).classList.toggle('hidden', view !== chip.dataset.view);
      }
      if (chip.dataset.view !== 'spelen') { stopGame(); leavePark(); }
    });
  });

  initPark();
  document.getElementById('mode-run').addEventListener('click', () => showMode('run'));
  document.getElementById('mode-park').addEventListener('click', () => showMode('park'));
  document.getElementById('run-terug').addEventListener('click', () => showMode(null));
  document.getElementById('park-terug').addEventListener('click', () => showMode(null));

  // besturing
  els.canvas.addEventListener('pointerdown', e => { e.preventDefault(); jump(); });
  document.getElementById('btn-jump').addEventListener('pointerdown', e => { e.preventDefault(); jump(); });
  document.addEventListener('keydown', e => {
    if (!game) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
    const t = GAME_TRICKS.find(t => t.key === e.key.toLowerCase() && checkReq(t.req, skills));
    if (t) doTrick(t);
  });
  document.getElementById('game-stop').addEventListener('click', stopGame);
}
