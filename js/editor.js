import { getClip, saveClip } from './db.js';
import { OBSTACLE_LABELS } from './tips.js';
import { makeThumb } from './camera.js';

const overlay = document.getElementById('player-overlay');
const video = document.getElementById('player-video');
const meta = document.getElementById('player-meta');
const trimPanel = document.getElementById('trim-panel');
const trimStart = document.getElementById('trim-start');
const trimEnd = document.getElementById('trim-end');
const trimInfo = document.getElementById('trim-info');
const trimStatus = document.getElementById('trim-status');
const btnLanded = document.getElementById('player-landed');

let current = null;
let currentUrl = '';
let rangeCheck = null;
let refreshFn = null;
let toggleLandedFn = null;
let removeFn = null;

export function initEditor({ onRefresh, onToggleLanded, onRemove }) {
  refreshFn = onRefresh;
  toggleLandedFn = onToggleLanded;
  removeFn = onRemove;

  document.getElementById('player-close').addEventListener('click', closePlayer);
  overlay.addEventListener('click', e => { if (e.target === overlay) closePlayer(); });

  document.getElementById('player-trim').addEventListener('click', () => {
    trimPanel.classList.toggle('hidden');
    if (!trimPanel.classList.contains('hidden')) {
      clearTrimWindow(); // tijdens het trimmen is de hele video bereikbaar
      setupTrimRange();
    } else {
      applyTrimWindow();
    }
  });

  btnLanded.addEventListener('click', async () => {
    if (!current) return;
    const landed = await toggleLandedFn(current.id);
    current.landed = landed;
    renderMeta();
  });

  document.getElementById('player-download').addEventListener('click', () => {
    if (!current) return;
    const a = document.createElement('a');
    a.href = currentUrl;
    const ext = (current.mime || '').includes('mp4') ? 'mp4' : 'webm';
    a.download = `flowsk8-${current.trick.replace(/\s+/g, '-')}.${ext}`;
    a.click();
  });

  document.getElementById('player-delete').addEventListener('click', async () => {
    if (!current) return;
    if (!confirm(`Clip "${current.trick}" echt weggooien?`)) return;
    await removeFn(current.id);
    closePlayer();
  });

  trimStart.addEventListener('input', () => {
    if (+trimStart.value >= +trimEnd.value) trimStart.value = Math.max(0, +trimEnd.value - 0.1);
    video.currentTime = +trimStart.value;
    updateTrimInfo();
  });
  trimEnd.addEventListener('input', () => {
    if (+trimEnd.value <= +trimStart.value) trimEnd.value = +trimStart.value + 0.1;
    video.currentTime = +trimEnd.value;
    updateTrimInfo();
  });

  document.getElementById('trim-preview').addEventListener('click', previewSelection);
  document.getElementById('trim-save').addEventListener('click', saveTrim);
}

export async function openPlayer(id) {
  current = await getClip(id);
  if (!current) return;
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = URL.createObjectURL(current.blob);
  video.src = currentUrl;
  trimPanel.classList.add('hidden');
  trimStatus.classList.add('hidden');
  applyTrimWindow();
  renderMeta();
  overlay.classList.remove('hidden');
}

// Soft-trim (iPhone): clip heeft trimStart/trimEnd — speel alleen dat stukje af
function clearTrimWindow() {
  if (rangeCheck) { video.removeEventListener('timeupdate', rangeCheck); rangeCheck = null; }
}

function applyTrimWindow() {
  clearTrimWindow();
  if (!current || current.trimStart == null) return;
  const s = current.trimStart;
  const e = current.trimEnd;
  const toStart = () => { video.currentTime = s; };
  if (video.readyState >= 1) toStart();
  else video.addEventListener('loadedmetadata', toStart, { once: true });
  rangeCheck = () => {
    if (video.currentTime >= e) { video.pause(); video.currentTime = s; }
    else if (video.currentTime < s - 0.3) { video.currentTime = s; }
  };
  video.addEventListener('timeupdate', rangeCheck);
}

function renderMeta() {
  const parts = [OBSTACLE_LABELS[current.obstacle],
    new Date(current.createdAt).toLocaleString('nl-NL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })];
  meta.innerHTML = `<div class="trick"></div>${parts.filter(Boolean).join(' · ')}`;
  meta.querySelector('.trick').textContent =
    `${current.trick}${current.landed ? ' ✔' : ''}`;
  btnLanded.classList.toggle('on', !!current.landed);
  btnLanded.textContent = current.landed ? '✔ Geland!' : '✔ Geland?';
}

export function closePlayer() {
  video.pause();
  clearTrimWindow();
  overlay.classList.add('hidden');
  if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = ''; }
  current = null;
}

function getDuration() {
  return new Promise(resolve => {
    if (isFinite(video.duration) && video.duration > 0) return resolve(video.duration);
    // webm van MediaRecorder heeft vaak duration=Infinity; truc: ver vooruit seeken
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      const d = video.duration;
      video.currentTime = 0;
      resolve(isFinite(d) ? d : 0);
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = 1e6;
  });
}

async function setupTrimRange() {
  const d = await getDuration();
  trimStart.max = d;
  trimEnd.max = d;
  trimStart.value = current && current.trimStart != null ? current.trimStart : 0;
  trimEnd.value = current && current.trimEnd != null ? Math.min(current.trimEnd, d) : d;
  updateTrimInfo();
}

function updateTrimInfo() {
  const len = Math.max(0, +trimEnd.value - +trimStart.value);
  trimInfo.textContent = `Selectie: ${(+trimStart.value).toFixed(1)}s → ${(+trimEnd.value).toFixed(1)}s (${len.toFixed(1)}s)`;
}

function previewSelection() {
  video.currentTime = +trimStart.value;
  video.play();
  const stopAt = +trimEnd.value;
  const check = () => {
    if (video.currentTime >= stopAt) { video.pause(); video.removeEventListener('timeupdate', check); }
  };
  video.addEventListener('timeupdate', check);
}

async function saveTrim() {
  if (!current) return;
  const start = +trimStart.value;
  const end = +trimEnd.value;
  if (end - start < 0.2) { alert('Selectie is te kort.'); return; }

  // iPhone/Safari: geen captureStream — sla knippunten op i.p.v. her-encoderen
  if (!video.captureStream && !video.mozCaptureStream) {
    const thumb = await makeThumb(current.blob, start + 0.1);
    const clip = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      trick: current.trick,
      obstacle: current.obstacle,
      landed: current.landed,
      blob: current.blob,
      mime: current.mime,
      thumb: thumb || current.thumb,
      trimStart: start,
      trimEnd: end,
    };
    await saveClip(clip);
    trimStatus.textContent = '✅ Getrimde clip opgeslagen! (speelt alleen jouw stukje af)';
    trimStatus.classList.remove('hidden');
    if (refreshFn) refreshFn();
    return;
  }

  trimStatus.textContent = '✂ Bezig met trimmen… (speelt de selectie af)';
  trimStatus.classList.remove('hidden');

  const stream = (video.captureStream || video.mozCaptureStream).call(video);
  const mime = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
    .find(m => MediaRecorder.isTypeSupported(m)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

  const done = new Promise(resolve => { rec.onstop = resolve; });

  video.muted = false;
  video.currentTime = start;
  await new Promise(r => video.addEventListener('seeked', r, { once: true }));
  rec.start(200);
  await video.play();

  await new Promise(resolve => {
    const check = () => {
      if (video.currentTime >= end || video.ended) {
        video.removeEventListener('timeupdate', check);
        resolve();
      }
    };
    video.addEventListener('timeupdate', check);
  });

  video.pause();
  rec.stop();
  await done;

  const blob = new Blob(chunks, { type: mime || 'video/webm' });
  const thumb = await makeThumb(blob);
  const clip = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    trick: current.trick,
    obstacle: current.obstacle,
    landed: current.landed,
    blob,
    mime: blob.type,
    thumb,
  };
  await saveClip(clip);
  trimStatus.textContent = '✅ Getrimde clip opgeslagen als nieuwe clip!';
  if (refreshFn) refreshFn();
}
