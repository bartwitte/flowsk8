const DB_NAME = 'flowsk8';
const STORE = 'clips';

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const out = fn(store);
    t.oncomplete = () => resolve(out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
  }));
}

export function saveClip(clip) {
  return tx('readwrite', s => s.put(clip)).then(() => clip);
}

export function getClip(id) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export function getAllClips() {
  return openDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  }));
}

export function deleteClip(id) {
  return tx('readwrite', s => s.delete(id));
}
