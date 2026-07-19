// Het Mega Skatepark in 3D — Brawl Stars-stijl: felle kleuren, camera schuin
// van boven, joystick in je linkerhand. Loop tegen skaters aan voor een
// game of SKATE (skate.js). Three.js wordt pas geladen als je het park opent.
import { initSkate, startBattle, stopBattle, getWins, tricklist } from './skate.js';

export const NPCS = [
  {
    id: 'bram', naam: 'Bram', emoji: '🧢', kleur: 0x4d9de0,
    intro: 'Buurjongen Bram wil wel een potje SKATE!',
    tricks: { 'ollie': 80, 'kickflip': 45, 'pop shove-it': 50 },
    spawn: [-8, -4],
  },
  {
    id: 'sanne', naam: 'Sanne', emoji: '🎀', kleur: 0xe15fbe,
    intro: 'Sanne skatet elke dag. Dit wordt lastig!',
    tricks: { 'ollie': 90, 'kickflip': 65, 'heelflip': 60, 'boardslide': 55, 'tre flip': 35 },
    spawn: [10, 6], vereist: 'bram',
  },
  {
    id: 'pim', naam: 'Pro Pim', emoji: '🕶', kleur: 0xf5a623,
    intro: 'Pro Pim. Sponsors. Videoparts. Veel succes…',
    tricks: { 'ollie': 95, 'kickflip': 85, 'heelflip': 80, 'tre flip': 70, '50-50 grind': 75, 'hardflip': 60 },
    spawn: [18, -10], vereist: 'sanne',
  },
];

let THREE = null;
let els = {};
let skills = null;
let scene, camera, renderer;
let speler = null; // {group, richting, trickT}
let npcs = []; // {def, group, doel, pauze, naamSprite}
let joy = null; // {baseX, baseY, dx, dy}
let keys = {};
let actief = false;
let rafId = 0, timerId = 0, laatst = 0;
let dichtbij = null;

const SLAB = { x: 24, z: 15 }; // halve maten van de betonvloer

function schedule() {
  if (document.hidden) timerId = setTimeout(() => loop(performance.now()), 1000 / 30);
  else rafId = requestAnimationFrame(loop);
}
const unschedule = () => { cancelAnimationFrame(rafId); clearTimeout(timerId); };

// ---------- bouwstenen ----------
const mat = (kleur) => new THREE.MeshLambertMaterial({ color: kleur });

function blok(w, h, d, kleur, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(kleur));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  return m;
}

function wig(breedte, hoogte, diepte, kleur, x, z, ry = 0) {
  // oplooprand: driehoekig profiel
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(diepte, 0); shape.lineTo(0, hoogte); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: breedte, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(-breedte / 2, 0, 0);
  const m = new THREE.Mesh(g, mat(kleur));
  m.position.set(x, 0, z);
  m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  return m;
}

function naamLabel(tekst) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = '900 64px -apple-system, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(16,16,20,.65)';
  const b = ctx.measureText(tekst).width + 48;
  ctx.beginPath(); ctx.roundRect(256 - b / 2, 20, b, 88, 24); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(tekst, 256, 66);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
  sprite.scale.set(3.4, 0.85, 1);
  return sprite;
}

function maakSkater(kleurShirt) {
  const g = new THREE.Group();
  // board + wielen
  const board = blokLos(0.85, 0.07, 0.26, 0x1a1a21, 0, 0.14, 0);
  g.add(board);
  for (const [wx, wz] of [[-0.3, 0.12], [0.3, 0.12], [-0.3, -0.12], [0.3, -0.12]]) {
    const wiel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10), mat(0xffd60a));
    wiel.rotation.x = Math.PI / 2;
    wiel.position.set(wx, 0.07, wz);
    g.add(wiel);
  }
  // lijf + hoofd + petje
  const lijf = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 10), mat(kleurShirt));
  lijf.position.y = 0.75; lijf.castShadow = true;
  g.add(lijf);
  const hoofd = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), mat(0xf1c27d));
  hoofd.position.y = 1.32; hoofd.castShadow = true;
  g.add(hoofd);
  const pet = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.09, 14), mat(0x101014));
  pet.position.y = 1.5;
  g.add(pet);
  return g;
}

function blokLos(w, h, d, kleur, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(kleur));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function boom(x, z) {
  const stam = blok(0.35, 1.2, 0.35, 0x8a5a2b, x, 0.6, z);
  stam.castShadow = true;
  const kruin = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), mat(0x3ddc84));
  kruin.position.set(x, 2, z);
  kruin.castShadow = true;
  scene.add(kruin);
}

// ---------- wereld ----------
function bouwWereld() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87c9f0); // vrolijke lucht

  camera = new THREE.PerspectiveCamera(55, 16 / 10, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x668855, 0.9));
  const zon = new THREE.DirectionalLight(0xfff2cc, 1.4);
  zon.position.set(14, 24, 10);
  zon.castShadow = true;
  zon.shadow.mapSize.set(1024, 1024);
  const sc = 30;
  zon.shadow.camera.left = -sc; zon.shadow.camera.right = sc;
  zon.shadow.camera.top = sc; zon.shadow.camera.bottom = -sc;
  scene.add(zon);

  // gras + betonvloer
  const gras = new THREE.Mesh(new THREE.PlaneGeometry(120, 90), mat(0x5cb85c));
  gras.rotation.x = -Math.PI / 2;
  gras.receiveShadow = true;
  scene.add(gras);
  const beton = new THREE.Mesh(new THREE.BoxGeometry(SLAB.x * 2 + 4, 0.2, SLAB.z * 2 + 4), mat(0x9a9aa5));
  beton.position.y = 0.0;
  beton.receiveShadow = true;
  scene.add(beton);

  // quarter pipes (noordkant)
  wig(8, 2.2, 3, 0xff8c42, -12, -SLAB.z + 1.5, Math.PI);
  wig(8, 2.2, 3, 0x4d9de0, 0, -SLAB.z + 1.5, Math.PI);
  wig(8, 2.2, 3, 0xe15fbe, 12, -SLAB.z + 1.5, Math.PI);

  // funbox in het midden + oploopjes
  blok(6, 1.1, 3, 0xc8c8d0, 0, 0.55, 0);
  wig(3, 1.1, 2.2, 0xc8c8d0, -4.1, 0, Math.PI / 2);
  wig(3, 1.1, 2.2, 0xc8c8d0, 4.1, 0, -Math.PI / 2);

  // rails (geel, op pootjes)
  for (const [rx, rz, lang, ry] of [[-10, 6, 6, 0], [12, 2, 7, Math.PI / 5]]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, lang, 10), mat(0xffd60a));
    rail.rotation.z = Math.PI / 2; rail.rotation.y = ry;
    rail.position.set(rx, 0.6, rz);
    rail.castShadow = true;
    scene.add(rail);
    blok(0.12, 0.6, 0.12, 0x54545e, rx - Math.cos(ry) * lang * 0.4, 0.3, rz + Math.sin(ry) * lang * 0.4);
    blok(0.12, 0.6, 0.12, 0x54545e, rx + Math.cos(ry) * lang * 0.4, 0.3, rz - Math.sin(ry) * lang * 0.4);
  }

  // trap (zuidwest) + halfpipe (oost)
  for (let i = 0; i < 4; i++) blok(4, 0.3 + i * 0.3, 0.9, 0xb0b0ba, -16, (0.3 + i * 0.3) / 2, 10 - i * 0.9);
  wig(7, 2.4, 3, 0xff5c5c, 21, 8, -Math.PI / 2);
  wig(7, 2.4, 3, 0xff5c5c, 13, 8, Math.PI / 2);

  // bomen rondom
  for (const [tx, tz] of [[-28, -14], [-28, 10], [28, -12], [28, 14], [-6, -20], [10, 20], [-20, 19], [22, -18]]) boom(tx, tz);

  // speler
  speler = { group: maakSkater(0xffd60a), richting: 0, trickT: 0, trickNaam: '' };
  speler.group.position.set(0, 0.1, 8);
  scene.add(speler.group);

  // "online" skaters (nu nog bots) — lopen rond over het park
  npcs = [];
  for (const def of NPCS) {
    const group = maakSkater(def.kleur);
    group.position.set(def.spawn[0], 0.1, def.spawn[1]);
    const label = naamLabel(def.naam);
    label.position.y = 2.1;
    group.add(label);
    scene.add(group);
    npcs.push({ def, group, label, doel: null, pauze: Math.random() * 2 });
  }
}

// ---------- besturing (Brawl Stars: joystick links) ----------
function initJoystick() {
  const wrap = els.wrap;
  const base = els.joyBase, knob = els.joyKnob;
  const R = 48;
  wrap.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    wrap.setPointerCapture(e.pointerId);
    const r = wrap.getBoundingClientRect();
    joy = { x: e.clientX - r.left, y: e.clientY - r.top, dx: 0, dy: 0 };
    base.style.left = `${joy.x}px`; base.style.top = `${joy.y}px`;
    knob.style.transform = 'translate(-50%,-50%)';
    base.classList.remove('hidden');
  });
  wrap.addEventListener('pointermove', e => {
    if (!joy) return;
    const r = wrap.getBoundingClientRect();
    let dx = (e.clientX - r.left) - joy.x;
    let dy = (e.clientY - r.top) - joy.y;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = dx / len * R; dy = dy / len * R; }
    joy.dx = dx / R; joy.dy = dy / R;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  });
  const stop = () => { joy = null; base.classList.add('hidden'); };
  wrap.addEventListener('pointerup', stop);
  wrap.addEventListener('pointercancel', stop);
}

// ---------- gameloop ----------
function step(dt) {
  // invoer: joystick of toetsen
  let dx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  let dz = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
  if (joy) { dx = joy.dx; dz = joy.dy; }
  const len = Math.hypot(dx, dz);
  if (len > 0.15) {
    const p = speler.group.position;
    p.x = Math.max(-SLAB.x, Math.min(SLAB.x, p.x + (dx / len) * 6 * dt * Math.min(1, len * 1.4)));
    p.z = Math.max(-SLAB.z, Math.min(SLAB.z, p.z + (dz / len) * 6 * dt * Math.min(1, len * 1.4)));
    speler.richting = Math.atan2(dx, dz);
  }
  // trick-animatie: sprongetje + 360 spin
  speler.trickT = Math.max(0, speler.trickT - dt);
  const t = speler.trickT > 0 ? 1 - speler.trickT / 0.6 : 0;
  speler.group.position.y = 0.1 + Math.sin(t * Math.PI) * 1.1;
  speler.group.rotation.y = speler.richting + (speler.trickT > 0 ? t * Math.PI * 2 : 0);

  // bots wandelen rond
  const wins = getWins();
  dichtbij = null;
  for (const n of npcs) {
    const opSlot = n.def.vereist && !wins[n.def.vereist];
    n.label.material.opacity = opSlot ? 0.35 : 1;
    const afstand = n.group.position.distanceTo(speler.group.position);
    if (!opSlot && afstand < 2.4) {
      dichtbij = n.def;
      n.group.lookAt(speler.group.position.x, n.group.position.y, speler.group.position.z);
      continue;
    }
    if (n.pauze > 0) { n.pauze -= dt; continue; }
    if (!n.doel || n.group.position.distanceTo(n.doel) < 0.5) {
      n.doel = new THREE.Vector3((Math.random() * 2 - 1) * (SLAB.x - 3), 0.1, (Math.random() * 2 - 1) * (SLAB.z - 3));
      n.pauze = 1 + Math.random() * 3;
      continue;
    }
    const richting = n.doel.clone().sub(n.group.position).normalize();
    n.group.position.addScaledVector(richting, 1.7 * dt);
    n.group.rotation.y = Math.atan2(richting.x, richting.z);
  }

  // uitdaag-prompt — maar één keer opbouwen per skater, anders wordt de knop
  // elke frame vervangen en gaat een echte vingertik (iPhone) verloren
  if (dichtbij) {
    const alGewonnen = getWins()[dichtbij.id];
    const key = dichtbij.id + (alGewonnen ? '-w' : '');
    if (els.prompt.dataset.key !== key) {
      els.prompt.dataset.key = key;
      els.prompt.innerHTML = `<b>${dichtbij.emoji} ${dichtbij.naam}</b> ${alGewonnen ? '🏆' : ''}<br>
        <button class="btn primary" id="daag-uit">🎮 Game of SKATE!</button>`;
      const uitdager = dichtbij;
      const start = e => {
        e.preventDefault();
        if (!tricklist(skills).length) {
          alert('Je tricklist is nog leeg!\n\nFilm een trick, land hem clean en markeer hem "geland" — dan kun je hem hier gebruiken. 🎥');
          return;
        }
        naarBattle(uitdager);
      };
      const knop = document.getElementById('daag-uit');
      knop.addEventListener('pointerdown', start);
    }
    els.prompt.classList.remove('hidden');
  } else {
    els.prompt.classList.add('hidden');
    delete els.prompt.dataset.key;
  }

  // camera volgt (vaste Brawl Stars-hoek)
  const doel = speler.group.position;
  camera.position.lerp(new THREE.Vector3(doel.x, doel.y + 14, doel.z + 14), 0.12);
  camera.lookAt(doel.x, 0, doel.z - 3);
}

function loop(now) {
  if (!actief) return;
  const dt = Math.min(0.05, (now - laatst) / 1000);
  laatst = now;
  step(dt);
  renderer.render(scene, camera);
  schedule();
}

function naarBattle(def) {
  actief = false;
  unschedule();
  els.parkMode.classList.add('hidden');
  const volgende = NPCS.find(n => n.vereist === def.id) || null;
  startBattle(def, skills, volgende);
}

function renderParkTricks() {
  const tricks = tricklist(skills).slice(0, 6);
  els.parkTricks.innerHTML = tricks.length
    ? ''
    : '<p class="trick-hint">Je tricklist is leeg — film en land een trick, dan kun je hem hier doen! 🎥</p>';
  for (const t of tricks) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = t.naam;
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      speler.trickT = 0.6;
    });
    els.parkTricks.appendChild(b);
  }
}

function maakRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  els.wrap.prepend(renderer.domElement);
  const past = () => {
    const w = els.wrap.clientWidth || 640;
    const h = Math.round(w * 10 / 16);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = 'auto';
    camera.aspect = 16 / 10;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', past);
  past();
}

// ---------- publiek ----------
export async function enterPark(s) {
  skills = s;
  stopBattle();
  els.parkMode.classList.remove('hidden');
  if (!THREE) {
    els.parkTricks.innerHTML = '<p class="trick-hint">Skatepark laden… 🛹</p>';
    THREE = await import('../lib/three.module.js');
    bouwWereld();
    maakRenderer();
    initJoystick();
  }
  renderParkTricks();
  actief = true;
  laatst = performance.now();
  unschedule();
  schedule();
}

export function leavePark() {
  actief = false;
  unschedule();
  stopBattle();
  if (els.parkMode) els.parkMode.classList.add('hidden');
}

export function initPark() {
  els = {
    wrap: document.getElementById('park3d-wrap'),
    prompt: document.getElementById('park-prompt'),
    parkMode: document.getElementById('park-mode'),
    parkTricks: document.getElementById('park-tricks'),
    joyBase: document.getElementById('joy-base'),
    joyKnob: document.getElementById('joy-knob'),
  };
  initSkate({ onTerug: () => enterPark(skills) });
  document.addEventListener('keydown', e => { keys[e.key] = true; keys[e.key.toLowerCase()] = true; });
  document.addEventListener('keyup', e => { keys[e.key] = false; keys[e.key.toLowerCase()] = false; });
}
