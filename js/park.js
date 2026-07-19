// Het Mega Skatepark (top-down) + game of SKATE.
// Je tricklist komt uit je échte clips: alleen tricks die je gefilmd én geland
// hebt kun je hier doen. Je landingskans hangt af van hoeveel clips je hebt
// en hoe clean je bent (geland ÷ alle pogingen van die trick).

const WORLD = { w: 1600, h: 1000 };
const VIEW = { w: 640, h: 400 };

const NPCS = [
  {
    id: 'bram', naam: 'Bram', emoji: '🧢', x: 700, y: 330, kleur: '#4d9de0',
    intro: 'Buurjongen Bram wil wel een potje SKATE!',
    tricks: { 'ollie': 80, 'kickflip': 45, 'pop shove-it': 50 },
    defendOnbekend: 20,
  },
  {
    id: 'sanne', naam: 'Sanne', emoji: '🎀', x: 1240, y: 560, kleur: '#e15fbe',
    intro: 'Sanne skatet elke dag. Dit wordt lastig!',
    tricks: { 'ollie': 90, 'kickflip': 65, 'heelflip': 60, 'boardslide': 55, 'tre flip': 35 },
    defendOnbekend: 35,
    vereist: 'bram',
  },
  {
    id: 'pim', naam: 'Pro Pim', emoji: '🕶', x: 380, y: 790, kleur: '#f5a623',
    intro: 'Pro Pim. Sponsors. Videoparts. Veel succes…',
    tricks: { 'ollie': 95, 'kickflip': 85, 'heelflip': 80, 'tre flip': 70, '50-50 grind': 75, 'hardflip': 60 },
    defendOnbekend: 55,
    vereist: 'sanne',
  },
];

const WINS_KEY = 'flowsk8-skate-wins';
const getWins = () => { try { return JSON.parse(localStorage.getItem(WINS_KEY)) || {}; } catch { return {}; } };
const saveWin = id => { const w = getWins(); w[id] = true; localStorage.setItem(WINS_KEY, JSON.stringify(w)); };

let skills = null;
let els = {};
let speler = { x: 800, y: 500, vx: 0, vy: 0, trickAnim: 0, trickNaam: '' };
let joystick = null; // {startX, startY, dx, dy}
let keys = {};
let dichtbijNpc = null;
let loopActief = false;
let rafId = 0, timerId = 0;
let laatst = 0;

// ---- tricklist uit je echte clips ----
export function spelerTricks() {
  return Object.entries(skills.byTrick).map(([naam, n]) => {
    const m = skills.totalByTrick[naam] || n;
    const clean = n / m;
    const kans = Math.min(95, Math.round(25 + 12 * Math.min(n, 5) + 25 * clean));
    return { naam, clips: n, totaal: m, clean, kans };
  }).sort((a, b) => b.kans - a.kans);
}

const spelerKans = naam => spelerTricks().find(t => t.naam === naam)?.kans ?? 15;

// ---------- park ----------
function schedule() {
  if (document.hidden) timerId = setTimeout(() => parkLoop(performance.now()), 1000 / 30);
  else rafId = requestAnimationFrame(parkLoop);
}
const unschedule = () => { cancelAnimationFrame(rafId); clearTimeout(timerId); };

function parkStep(dt) {
  let dx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  let dy = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
  if (joystick && (Math.abs(joystick.dx) > 8 || Math.abs(joystick.dy) > 8)) {
    dx = joystick.dx; dy = joystick.dy;
  }
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    speler.x += (dx / len) * 230 * dt;
    speler.y += (dy / len) * 230 * dt;
    speler.x = Math.max(30, Math.min(WORLD.w - 30, speler.x));
    speler.y = Math.max(30, Math.min(WORLD.h - 30, speler.y));
  }
  speler.trickAnim = Math.max(0, speler.trickAnim - dt);

  // in de buurt van een uitdager?
  dichtbijNpc = null;
  const wins = getWins();
  for (const npc of NPCS) {
    if (npc.vereist && !wins[npc.vereist]) continue;
    if (Math.hypot(npc.x - speler.x, npc.y - speler.y) < 70) { dichtbijNpc = npc; break; }
  }
  const prompt = els.prompt;
  if (dichtbijNpc) {
    const alGewonnen = wins[dichtbijNpc.id];
    prompt.innerHTML = `<b>${dichtbijNpc.emoji} ${dichtbijNpc.naam}</b> ${alGewonnen ? '🏆 al verslagen — nog een potje?' : ''}<br>
      <button class="btn primary" id="daag-uit">🎮 Game of SKATE!</button>`;
    prompt.classList.remove('hidden');
    document.getElementById('daag-uit').onclick = () => {
      if (!spelerTricks().length) {
        alert('Je tricklist is nog leeg!\n\nFilm een trick, land hem clean en markeer hem "geland" — dan kun je hem hier gebruiken. 🎥');
        return;
      }
      startBattle(dichtbijNpc);
    };
  } else {
    prompt.classList.add('hidden');
  }
}

function camera() {
  return {
    x: Math.max(0, Math.min(WORLD.w - VIEW.w, speler.x - VIEW.w / 2)),
    y: Math.max(0, Math.min(WORLD.h - VIEW.h, speler.y - VIEW.h / 2)),
  };
}

function parkDraw() {
  const ctx = els.canvas.getContext('2d');
  const cam = camera();
  ctx.save();
  ctx.clearRect(0, 0, VIEW.w, VIEW.h);
  ctx.translate(-cam.x, -cam.y);

  // gras + beton
  ctx.fillStyle = '#1d2b1f';
  ctx.fillRect(cam.x, cam.y, VIEW.w, VIEW.h);
  ctx.fillStyle = '#3a3a42';
  ctx.beginPath(); ctx.roundRect(90, 70, WORLD.w - 180, WORLD.h - 140, 40); ctx.fill();
  ctx.strokeStyle = '#54545e'; ctx.lineWidth = 4; ctx.stroke();

  // bowl (twee ringen)
  ctx.fillStyle = '#2e2e36';
  ctx.beginPath(); ctx.arc(350, 300, 145, 0, 7); ctx.fill();
  ctx.fillStyle = '#232329';
  ctx.beginPath(); ctx.arc(350, 300, 95, 0, 7); ctx.fill();
  ctx.strokeStyle = '#54545e'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(350, 300, 145, 0, 7); ctx.stroke();

  // halfpipe
  ctx.fillStyle = '#2e2e36'; ctx.fillRect(1050, 130, 380, 210);
  ctx.strokeStyle = '#54545e';
  ctx.strokeRect(1050, 130, 380, 210);
  ctx.beginPath(); ctx.moveTo(1050, 235); ctx.lineTo(1430, 235); ctx.stroke();
  ctx.fillStyle = '#54545e'; ctx.fillRect(1050, 130, 26, 210); ctx.fillRect(1404, 130, 26, 210);

  // rails
  ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(620, 620); ctx.lineTo(920, 620); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(520, 240); ctx.lineTo(760, 200); ctx.stroke();

  // funbox
  ctx.fillStyle = '#4a4a54';
  ctx.beginPath(); ctx.roundRect(960, 660, 220, 140, 10); ctx.fill();
  ctx.fillStyle = '#3a3a42'; ctx.fillRect(1010, 695, 120, 70);

  // trap
  ctx.fillStyle = '#4a4a54';
  for (let i = 0; i < 5; i++) ctx.fillRect(180 + i * 22, 690, 22, 130);

  // uitdagers
  const wins = getWins();
  ctx.textAlign = 'center';
  for (const npc of NPCS) {
    const opSlot = npc.vereist && !wins[npc.vereist];
    ctx.globalAlpha = opSlot ? 0.4 : 1;
    ctx.fillStyle = npc.kleur;
    ctx.beginPath(); ctx.arc(npc.x, npc.y, 16, 0, 7); ctx.fill();
    ctx.font = '20px sans-serif';
    ctx.fillText(npc.emoji, npc.x, npc.y + 7);
    ctx.font = '900 13px -apple-system, sans-serif';
    ctx.fillStyle = '#f2f2f5';
    ctx.fillText(
      opSlot ? `🔒 versla eerst ${NPCS.find(n => n.id === npc.vereist).naam}` : `${wins[npc.id] ? '🏆 ' : ''}${npc.naam}`,
      npc.x, npc.y - 26,
    );
    ctx.globalAlpha = 1;
  }

  // speler
  ctx.save();
  ctx.translate(speler.x, speler.y);
  if (speler.trickAnim > 0) ctx.rotate((1 - speler.trickAnim / 0.5) * Math.PI * 2);
  ctx.fillStyle = '#1a1a21';
  ctx.strokeStyle = '#f2f2f5'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-9, -22, 18, 44, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd60a';
  ctx.beginPath(); ctx.arc(-6, -14, 3.5, 0, 7); ctx.arc(6, -14, 3.5, 0, 7);
  ctx.arc(-6, 14, 3.5, 0, 7); ctx.arc(6, 14, 3.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#f2f2f5';
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
  ctx.restore();
  if (speler.trickAnim > 0) {
    ctx.font = '900 16px -apple-system, sans-serif';
    ctx.fillStyle = '#3ddc84';
    ctx.fillText(speler.trickNaam + '!', speler.x, speler.y - 34);
  }

  ctx.restore();
}

function parkLoop(now) {
  if (!loopActief) return;
  const dt = Math.min(0.05, (now - laatst) / 1000);
  laatst = now;
  parkStep(dt);
  parkDraw();
  schedule();
}

function renderParkTricks() {
  const tricks = spelerTricks().slice(0, 6);
  els.parkTricks.innerHTML = tricks.length
    ? ''
    : '<p class="trick-hint">Je tricklist is leeg — film en land een trick, dan kun je hem hier doen! 🎥</p>';
  for (const t of tricks) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = t.naam;
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      speler.trickAnim = 0.5;
      speler.trickNaam = t.naam;
    });
    els.parkTricks.appendChild(b);
  }
}

export function enterPark(s) {
  skills = s;
  els.battle.classList.add('hidden');
  els.parkMode.classList.remove('hidden');
  renderParkTricks();
  loopActief = true;
  laatst = performance.now();
  unschedule();
  schedule();
}

export function leavePark() {
  loopActief = false;
  unschedule();
  if (els.parkMode) {
    els.parkMode.classList.add('hidden');
    els.battle.classList.add('hidden');
  }
}

// ---------- game of SKATE ----------
const LETTERS = ['S', 'K', 'A', 'T', 'E'];
let battle = null;

function startBattle(npc) {
  loopActief = false;
  unschedule();
  els.parkMode.classList.add('hidden');
  els.battle.classList.remove('hidden');
  battle = {
    npc,
    spelerLetters: 0, npcLetters: 0,
    beurt: 'speler', // wie mag een trick zetten
    fase: 'kies',    // kies | verdedig | klaar
    trick: null,
    log: [`${npc.emoji} ${npc.intro}`, 'Jij mag beginnen — kies een trick uit je lijst!'],
    bezig: false,
  };
  renderBattle();
}

const rol = kans => Math.random() * 100 < kans;
const npcKans = (npc, trick) => npc.tricks[trick] ?? npc.defendOnbekend;

function letters(n) {
  return LETTERS.map((l, i) => `<span class="${i < n ? 'op' : ''}">${l}</span>`).join('');
}

function renderBattle() {
  const b = battle;
  const klaar = b.spelerLetters >= 5 || b.npcLetters >= 5;
  let acties = '';
  if (klaar) {
    const gewonnen = b.npcLetters >= 5;
    if (gewonnen) saveWin(b.npc.id);
    const volgende = NPCS.find(n => n.vereist === b.npc.id);
    acties = `<div class="battle-einde">${gewonnen
      ? `<h2>🏆 Jij wint van ${b.npc.naam}!</h2>${volgende ? `<p>${volgende.emoji} <b>${volgende.naam}</b> wacht nu op je in het park!</p>` : '<p>Je hebt iedereen verslagen. Koning van het park! 👑</p>'}`
      : '<h2>💀 S-K-A-T-E… verloren!</h2><p>Meer clips landen op straat = hogere kansen. Ga filmen! 🎥</p>'}
      <button class="btn primary" id="battle-terug">Terug naar het park</button></div>`;
  } else if (b.bezig) {
    acties = '<p class="battle-wacht">…</p>';
  } else if (b.fase === 'kies' && b.beurt === 'speler') {
    acties = '<p class="battle-vraag">Zet een trick:</p><div class="battle-tricks">' +
      spelerTricks().map(t =>
        `<button class="btn trick-zet" data-trick="${t.naam}">${t.naam}<small>${t.kans}% · ${t.clips} clip${t.clips === 1 ? '' : 's'} · ${Math.round(t.clean * 100)}% clean</small></button>`
      ).join('') + '</div>';
  } else if (b.fase === 'verdedig') {
    acties = `<p class="battle-vraag">${b.npc.naam} zette <b>${b.trick}</b> — nu jij! (${spelerKans(b.trick)}% kans)</p>
      <button class="btn primary" id="battle-probeer">🛹 Probeer de ${b.trick}!</button>`;
  }
  els.battle.innerHTML = `
    <div class="battle-koppen">
      <div><b>JIJ</b><div class="skate-letters">${letters(b.spelerLetters)}</div></div>
      <div class="battle-vs">VS</div>
      <div><b>${b.npc.emoji} ${b.npc.naam.toUpperCase()}</b><div class="skate-letters">${letters(b.npcLetters)}</div></div>
    </div>
    <div class="battle-log">${b.log.slice(-4).map(r => `<p>${r}</p>`).join('')}</div>
    ${acties}`;

  els.battle.querySelectorAll('.trick-zet').forEach(btn =>
    btn.addEventListener('click', () => spelerZet(btn.dataset.trick)));
  document.getElementById('battle-probeer')?.addEventListener('click', spelerVerdedigt);
  document.getElementById('battle-terug')?.addEventListener('click', () => enterPark(skills));
}

const wacht = ms => new Promise(r => setTimeout(r, ms));
function meld(regel) { battle.log.push(regel); renderBattle(); }

async function spelerZet(trick) {
  const b = battle;
  b.bezig = true;
  meld(`Jij zet <b>${trick}</b> (${spelerKans(trick)}%)…`);
  await wacht(900);
  if (!rol(spelerKans(trick))) {
    meld('❌ Gemist! De beurt gaat naar ' + b.npc.naam + '.');
    b.beurt = 'npc'; b.fase = 'kies'; b.bezig = false;
    await wacht(1100);
    npcZet();
    return;
  }
  meld('✅ GELAND! Nu ' + b.npc.naam + '…');
  await wacht(1100);
  if (rol(npcKans(b.npc, trick))) {
    meld(`😤 ${b.npc.naam} landt hem ook. Jij blijft aan zet.`);
  } else {
    b.npcLetters += 1;
    meld(`🔥 ${b.npc.naam} mist! Letter: <b>${LETTERS[b.npcLetters - 1]}</b>`);
  }
  b.fase = 'kies'; b.bezig = false;
  renderBattle();
}

async function npcZet() {
  const b = battle;
  b.bezig = true;
  // npc kiest een trick, met voorkeur voor z'n beste
  const opties = Object.entries(b.npc.tricks);
  const totaal = opties.reduce((s, [, k]) => s + k + 10, 0);
  let r = Math.random() * totaal;
  let keuze = opties[0][0];
  for (const [naam, k] of opties) { r -= k + 10; if (r <= 0) { keuze = naam; break; } }
  meld(`${b.npc.naam} zet <b>${keuze}</b>…`);
  await wacht(1000);
  if (!rol(npcKans(b.npc, keuze))) {
    meld(`❌ ${b.npc.naam} mist z'n eigen trick! Jij mag zetten.`);
    b.beurt = 'speler'; b.fase = 'kies'; b.bezig = false;
    renderBattle();
    return;
  }
  meld(`✅ ${b.npc.naam} landt de ${keuze}. Nu jij!`);
  b.trick = keuze;
  b.fase = 'verdedig';
  b.bezig = false;
  renderBattle();
}

async function spelerVerdedigt() {
  const b = battle;
  b.bezig = true;
  meld(`Jij probeert de <b>${b.trick}</b> (${spelerKans(b.trick)}%)…`);
  await wacht(900);
  if (rol(spelerKans(b.trick))) {
    meld('✅ GELAND! Geen letter.');
  } else {
    b.spelerLetters += 1;
    meld(`❌ Gemist… Letter: <b>${LETTERS[b.spelerLetters - 1]}</b>`);
  }
  if (b.spelerLetters >= 5) { b.bezig = false; renderBattle(); return; }
  await wacht(1100);
  b.bezig = false;
  npcZet(); // npc bleef aan zet
}

export function initPark() {
  els = {
    canvas: document.getElementById('park-canvas'),
    prompt: document.getElementById('park-prompt'),
    parkMode: document.getElementById('park-mode'),
    parkTricks: document.getElementById('park-tricks'),
    battle: document.getElementById('skate-battle'),
  };
  els.canvas.width = VIEW.w;
  els.canvas.height = VIEW.h;

  // joystick: sleep ergens op het park
  els.canvas.addEventListener('pointerdown', e => {
    els.canvas.setPointerCapture(e.pointerId);
    joystick = { startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 };
  });
  els.canvas.addEventListener('pointermove', e => {
    if (joystick) { joystick.dx = e.clientX - joystick.startX; joystick.dy = e.clientY - joystick.startY; }
  });
  const stopJoy = () => { joystick = null; };
  els.canvas.addEventListener('pointerup', stopJoy);
  els.canvas.addEventListener('pointercancel', stopJoy);

  document.addEventListener('keydown', e => { keys[e.key.replace('Arrow', 'Arrow')] = true; keys[e.key.toLowerCase()] = true; });
  document.addEventListener('keyup', e => { keys[e.key] = false; keys[e.key.toLowerCase()] = false; });
}
