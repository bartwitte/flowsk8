import { saveClip } from './db.js';
import { randomTip } from './tips.js';

const preview = document.getElementById('cam-preview');
const camError = document.getElementById('cam-error');
const recTimer = document.getElementById('rec-timer');
const btnRecord = document.getElementById('btn-record');
const btnFlip = document.getElementById('btn-flip');

const savePanel = document.getElementById('save-panel');
const savePreview = document.getElementById('save-preview');
const saveTrick = document.getElementById('save-trick');
const saveObstacles = document.getElementById('save-obstacles');
const saveLanded = document.getElementById('save-landed');

const afterTip = document.getElementById('after-tip');
const afterTipText = document.getElementById('after-tip-text');

let stream = null;
let recorder = null;
let chunks = [];
let facing = 'environment';
let timerInterval = null;
let pendingBlob = null;
let pendingMime = '';
let onSaved = null;

export function setOnSaved(fn) { onSaved = fn; }

function pickMime() {
  const candidates = [
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return candidates.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

export async function startCamera() {
  stopCamera();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });
    preview.srcObject = stream;
    camError.classList.add('hidden');
  } catch (err) {
    console.error('camera error', err);
    camError.classList.remove('hidden');
  }
}

export function stopCamera() {
  if (recorder && recorder.state === 'recording') recorder.stop();
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
    preview.srcObject = null;
  }
}

function startTimer() {
  const t0 = Date.now();
  recTimer.classList.remove('hidden');
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    recTimer.textContent = `● ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 250);
}

function stopTimer() {
  clearInterval(timerInterval);
  recTimer.classList.add('hidden');
  recTimer.textContent = '● 0:00';
}

function toggleRecord() {
  if (!stream) return;
  if (recorder && recorder.state === 'recording') {
    recorder.stop();
    return;
  }
  chunks = [];
  pendingMime = pickMime();
  recorder = new MediaRecorder(stream, pendingMime ? { mimeType: pendingMime } : undefined);
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = () => {
    btnRecord.classList.remove('recording');
    stopTimer();
    pendingBlob = new Blob(chunks, { type: pendingMime || 'video/webm' });
    showSavePanel();
  };
  recorder.start();
  btnRecord.classList.add('recording');
  startTimer();
}

function showSavePanel() {
  savePreview.src = URL.createObjectURL(pendingBlob);
  saveTrick.value = '';
  saveLanded.checked = false;
  saveObstacles.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  afterTip.classList.add('hidden');
  savePanel.classList.remove('hidden');
  savePanel.scrollIntoView({ behavior: 'smooth' });
}

function selectedObstacle() {
  const active = saveObstacles.querySelector('.chip.active');
  return active ? active.dataset.v : '';
}

export function makeThumb(blob, time = 0.1) {
  return new Promise(resolve => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.src = URL.createObjectURL(blob);
    const done = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = Math.round(320 * (v.videoHeight / v.videoWidth)) || 240;
        canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        resolve('');
      } finally {
        URL.revokeObjectURL(v.src);
      }
    };
    v.onloadeddata = () => { v.currentTime = time; };
    v.onseeked = done;
    v.onerror = () => resolve('');
    setTimeout(() => resolve(''), 4000);
  });
}

async function confirmSave() {
  if (!pendingBlob) return;
  const obstacle = selectedObstacle();
  const thumb = await makeThumb(pendingBlob);
  const clip = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    trick: saveTrick.value.trim().toLowerCase() || 'trick',
    obstacle,
    landed: saveLanded.checked,
    blob: pendingBlob,
    mime: pendingBlob.type,
    thumb,
  };
  await saveClip(clip);
  pendingBlob = null;
  savePreview.pause();
  URL.revokeObjectURL(savePreview.src);
  savePanel.classList.add('hidden');
  afterTipText.innerHTML = randomTip(obstacle);
  afterTip.classList.remove('hidden');
  if (onSaved) onSaved();
}

function discard() {
  pendingBlob = null;
  savePreview.pause();
  URL.revokeObjectURL(savePreview.src);
  savePanel.classList.add('hidden');
}

export function initCamera() {
  btnRecord.addEventListener('click', toggleRecord);
  btnFlip.addEventListener('click', () => {
    facing = facing === 'environment' ? 'user' : 'environment';
    startCamera();
  });
  document.getElementById('cam-retry').addEventListener('click', startCamera);
  saveObstacles.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const was = chip.classList.contains('active');
      saveObstacles.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      if (!was) chip.classList.add('active');
    });
  });
  document.getElementById('save-confirm').addEventListener('click', confirmSave);
  document.getElementById('save-discard').addEventListener('click', discard);
  document.getElementById('after-again').addEventListener('click', () => {
    afterTip.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
