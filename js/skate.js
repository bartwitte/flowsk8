// Game of SKATE — Willems regels:
// - alleen tricks die je écht gefilmd én geland hebt zitten in je tricklist
// - kans = aantal clips + hoe clean (geland ÷ pogingen)
// - kent iemand de trick niet (niet unlockt)? Meteen een letter.

const LETTERS = ['S', 'K', 'A', 'T', 'E'];

const WINS_KEY = 'flowsk8-skate-wins';
export const getWins = () => { try { return JSON.parse(localStorage.getItem(WINS_KEY)) || {}; } catch { return {}; } };
const saveWin = id => { const w = getWins(); w[id] = true; localStorage.setItem(WINS_KEY, JSON.stringify(w)); };

let els = null;
let onTerugFn = null;
let skills = null;
let battle = null;

export function tricklist(s) {
  return Object.entries(s.byTrick).map(([naam, n]) => {
    const m = s.totalByTrick[naam] || n;
    const clean = n / m;
    const kans = Math.min(95, Math.round(25 + 12 * Math.min(n, 5) + 25 * clean));
    return { naam, clips: n, totaal: m, clean, kans };
  }).sort((a, b) => b.kans - a.kans);
}

const spelerKent = naam => !!skills.byTrick[naam];
const spelerKans = naam => tricklist(skills).find(t => t.naam === naam)?.kans ?? 0;
const npcKent = (npc, naam) => naam in npc.tricks;
const rol = kans => Math.random() * 100 < kans;

export function initSkate({ onTerug }) {
  els = document.getElementById('skate-battle');
  onTerugFn = onTerug;
}

export function startBattle(npc, s, volgendeNpc = null) {
  skills = s;
  els.classList.remove('hidden');
  battle = {
    npc, volgendeNpc,
    spelerLetters: 0, npcLetters: 0,
    fase: 'kies', trick: null, bezig: false,
    log: [`${npc.emoji} ${npc.intro}`, 'Jij mag beginnen — kies een trick uit je lijst!'],
  };
  renderBattle();
}

export function stopBattle() {
  battle = null;
  if (els) els.classList.add('hidden');
}

function letters(n) {
  return LETTERS.map((l, i) => `<span class="${i < n ? 'op' : ''}">${l}</span>`).join('');
}

function renderBattle() {
  if (!battle) return;
  const b = battle;
  const klaar = b.spelerLetters >= 5 || b.npcLetters >= 5;
  let acties = '';
  if (klaar) {
    const gewonnen = b.npcLetters >= 5;
    if (gewonnen) saveWin(b.npc.id);
    const volgende = b.volgendeNpc;
    acties = `<div class="battle-einde">${gewonnen
      ? `<h2>🏆 Jij wint van ${b.npc.naam}!</h2>${volgende ? `<p>${volgende.emoji} <b>${volgende.naam}</b> skatet nu ook in het park!</p>` : '<p>Je hebt iedereen verslagen. Koning van het park! 👑</p>'}`
      : '<h2>💀 S-K-A-T-E… verloren!</h2><p>Meer clips landen op straat = hogere kansen én meer tricks in je lijst. Ga filmen! 🎥</p>'}
      <button class="btn primary" id="battle-terug">Terug naar het park</button></div>`;
  } else if (b.bezig) {
    acties = '<p class="battle-wacht">…</p>';
  } else if (b.fase === 'kies') {
    acties = '<p class="battle-vraag">Zet een trick:</p><div class="battle-tricks">' +
      tricklist(skills).map(t =>
        `<button class="btn trick-zet" data-trick="${t.naam}">${t.naam}<small>${t.kans}% · ${t.clips} clip${t.clips === 1 ? '' : 's'} · ${Math.round(t.clean * 100)}% clean</small></button>`
      ).join('') + '</div>';
  } else if (b.fase === 'verdedig') {
    acties = `<p class="battle-vraag">${b.npc.naam} zette <b>${b.trick}</b> — nu jij! (${spelerKans(b.trick)}% kans)</p>
      <button class="btn primary" id="battle-probeer">🛹 Probeer de ${b.trick}!</button>`;
  }
  els.innerHTML = `
    <div class="battle-koppen">
      <div><b>JIJ</b><div class="skate-letters">${letters(b.spelerLetters)}</div></div>
      <div class="battle-vs">VS</div>
      <div><b>${b.npc.emoji} ${b.npc.naam.toUpperCase()}</b><div class="skate-letters">${letters(b.npcLetters)}</div></div>
    </div>
    <div class="battle-log">${b.log.slice(-4).map(r => `<p>${r}</p>`).join('')}</div>
    ${acties}`;

  els.querySelectorAll('.trick-zet').forEach(btn =>
    btn.addEventListener('click', () => spelerZet(btn.dataset.trick)));
  document.getElementById('battle-probeer')?.addEventListener('click', spelerVerdedigt);
  document.getElementById('battle-terug')?.addEventListener('click', () => { stopBattle(); onTerugFn(); });
}

const wacht = ms => new Promise(r => setTimeout(r, ms));
function meld(regel) { if (battle) { battle.log.push(regel); renderBattle(); } }

async function spelerZet(trick) {
  const b = battle;
  b.bezig = true;
  meld(`Jij zet <b>${trick}</b> (${spelerKans(trick)}%)…`);
  await wacht(900);
  if (!rol(spelerKans(trick))) {
    meld(`❌ Gemist! De beurt gaat naar ${b.npc.naam}.`);
    b.bezig = false; b.fase = 'kies';
    await wacht(1100);
    npcZet();
    return;
  }
  meld(`✅ GELAND! Nu ${b.npc.naam}…`);
  await wacht(1100);
  if (!npcKent(b.npc, trick)) {
    // Willems regel: trick niet unlockt = meteen een letter
    b.npcLetters += 1;
    meld(`😱 ${b.npc.naam} heeft geen ${trick} unlockt — letter <b>${LETTERS[b.npcLetters - 1]}</b>!`);
  } else if (rol(b.npc.tricks[trick])) {
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
  if (!b) return;
  b.bezig = true;
  const opties = Object.entries(b.npc.tricks);
  const totaal = opties.reduce((s, [, k]) => s + k + 10, 0);
  let r = Math.random() * totaal;
  let keuze = opties[0][0];
  for (const [naam, k] of opties) { r -= k + 10; if (r <= 0) { keuze = naam; break; } }
  meld(`${b.npc.naam} zet <b>${keuze}</b>…`);
  await wacht(1000);
  if (!rol(b.npc.tricks[keuze])) {
    meld(`❌ ${b.npc.naam} mist z'n eigen trick! Jij mag zetten.`);
    b.fase = 'kies'; b.bezig = false;
    renderBattle();
    return;
  }
  if (!spelerKent(keuze)) {
    // Willems regel, ook voor jou: niet unlockt = letter
    b.spelerLetters += 1;
    meld(`✅ ${b.npc.naam} landt de ${keuze} — en jij hebt geen ${keuze} unlockt! Letter <b>${LETTERS[b.spelerLetters - 1]}</b>. Film hem op straat! 🎥`);
    if (b.spelerLetters >= 5) { b.bezig = false; renderBattle(); return; }
    await wacht(1400);
    b.bezig = false;
    npcZet();
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
  npcZet();
}
