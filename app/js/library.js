import { getAllClips, saveClip, deleteClip, getClip } from './db.js';
import { OBSTACLE_LABELS } from './tips.js';
import { openPlayer } from './editor.js';

const grid = document.getElementById('clip-grid');
const emptyMsg = document.getElementById('clips-empty');
const filterTrick = document.getElementById('filter-trick');
const filterObstacles = document.getElementById('filter-obstacles');
const filterLanded = document.getElementById('filter-landed');

let clips = [];

function activeObstacle() {
  const a = filterObstacles.querySelector('.chip.active');
  return a ? a.dataset.v : '';
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function render() {
  const trick = filterTrick.value;
  const obstacle = activeObstacle();
  const landedOnly = filterLanded.checked;

  const shown = clips.filter(c =>
    (!trick || c.trick === trick) &&
    (!obstacle || c.obstacle === obstacle) &&
    (!landedOnly || c.landed)
  );

  grid.innerHTML = '';
  emptyMsg.classList.toggle('hidden', shown.length > 0);
  emptyMsg.textContent = clips.length === 0
    ? 'Nog geen clips. Ga filmen! 🎥'
    : 'Geen clips met deze filters.';

  for (const clip of shown) {
    const card = document.createElement('div');
    card.className = 'clip-card';
    card.innerHTML = `
      <div class="thumb" style="${clip.thumb ? `background-image:url(${clip.thumb})` : ''}">
        ${clip.landed ? '<span class="badge">✔ CLEAN</span>' : ''}
      </div>
      <div class="info">
        <div class="trick"></div>
        <div class="sub"></div>
      </div>`;
    card.querySelector('.trick').textContent = clip.trick;
    card.querySelector('.sub').textContent =
      [OBSTACLE_LABELS[clip.obstacle], fmtDate(clip.createdAt), clip.trimStart != null ? '✂' : '']
        .filter(Boolean).join(' · ');
    card.addEventListener('click', () => openPlayer(clip.id));
    grid.appendChild(card);
  }
}

function refreshTrickOptions() {
  const current = filterTrick.value;
  const tricks = [...new Set(clips.map(c => c.trick))].sort();
  filterTrick.innerHTML = '<option value="">Alle tricks</option>' +
    tricks.map(t => `<option${t === current ? ' selected' : ''}></option>`).join('');
  // set option values/text safely
  const opts = filterTrick.querySelectorAll('option');
  tricks.forEach((t, i) => { opts[i + 1].value = t; opts[i + 1].textContent = t; });
}

export async function refreshLibrary() {
  clips = await getAllClips();
  refreshTrickOptions();
  render();
}

export async function toggleLanded(id) {
  const clip = await getClip(id);
  if (!clip) return;
  clip.landed = !clip.landed;
  await saveClip(clip);
  await refreshLibrary();
  return clip.landed;
}

export async function removeClip(id) {
  await deleteClip(id);
  await refreshLibrary();
}

export function initLibrary() {
  filterTrick.addEventListener('change', render);
  filterLanded.addEventListener('change', render);
  filterObstacles.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const was = chip.classList.contains('active');
      filterObstacles.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      if (!was) chip.classList.add('active');
      render();
    });
  });
  refreshLibrary();
}
