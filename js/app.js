import { initCamera, startCamera, stopCamera, setOnSaved } from './camera.js';
import { initLibrary, refreshLibrary, toggleLanded, removeClip } from './library.js';
import { initEditor } from './editor.js';
import { TIPS, OBSTACLE_LABELS } from './tips.js';

const tabs = document.querySelectorAll('.tabbar button');
const sections = document.querySelectorAll('.tab');

function showTab(name) {
  tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  sections.forEach(s => s.classList.toggle('active', s.id === `tab-${name}`));
  if (name === 'filmen') startCamera();
  else stopCamera();
  if (name === 'clips') refreshLibrary();
}

tabs.forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));

// Tips-tab vullen
const tipsList = document.getElementById('tips-list');
for (const [key, tips] of Object.entries(TIPS)) {
  const h = document.createElement('h3');
  h.textContent = key === 'algemeen' ? 'Altijd' : OBSTACLE_LABELS[key];
  h.style.cssText = 'margin:18px 0 8px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;font-size:14px;';
  tipsList.appendChild(h);
  for (const tip of tips) {
    const card = document.createElement('div');
    card.className = 'tip-card';
    card.style.marginBottom = '8px';
    card.innerHTML = `<p>${tip}</p>`;
    tipsList.appendChild(card);
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('sw', err));
}

initCamera();
initLibrary();
initEditor({ onRefresh: refreshLibrary, onToggleLanded: toggleLanded, onRemove: removeClip });
setOnSaved(refreshLibrary);
startCamera();
