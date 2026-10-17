// 本地数据库：IndexedDB 封装
// subjects 观察对象 / records 记录 / photos 图片 / meta 设置

const DB_NAME = 'observation-record';
const DB_VERSION = 1;

let dbPromise = null;

export function uid() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('subjects')) {
        const s = db.createObjectStore('subjects', { keyPath: 'id' });
        s.createIndex('sort', 'sort');
      }
      if (!db.objectStoreNames.contains('records')) {
        const r = db.createObjectStore('records', { keyPath: 'id' });
        r.createIndex('subjectId', 'subjectId');
        r.createIndex('observedAt', 'observedAt');
        r.createIndex('dimension', 'dimension');
      }
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txP(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  });
}

export async function getAll(storeName) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  return reqP(tx.objectStore(storeName).getAll());
}

export async function get(storeName, key) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  return reqP(tx.objectStore(storeName).get(key));
}

export async function put(storeName, value) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(value);
  await txP(tx);
  return value;
}

export async function remove(storeName, key) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
  await txP(tx);
}

// ---------- 观察对象 ----------

export async function listSubjects() {
  const list = await getAll('subjects');
  return list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.code).localeCompare(String(b.code), 'zh'));
}

export function getSubject(id) {
  return get('subjects', id);
}

export function saveSubject(subject) {
  return put('subjects', subject);
}

export function deleteSubject(id) {
  return remove('subjects', id);
}

// ---------- 记录 ----------

export async function listAllRecords() {
  const list = await getAll('records');
  return list.sort((a, b) => String(b.observedAt).localeCompare(String(a.observedAt)));
}

export async function listRecords({ subjectId = '', dimension = '', from = '', to = '' } = {}) {
  let list = await listAllRecords();
  if (subjectId) list = list.filter(r => r.subjectId === subjectId);
  if (dimension) list = list.filter(r => r.dimension === dimension);
  if (from) list = list.filter(r => r.observedAt >= from);
  if (to) list = list.filter(r => r.observedAt <= to);
  return list;
}

export function getRecord(id) {
  return get('records', id);
}

export function saveRecord(record) {
  return put('records', record);
}

export function deleteRecord(id) {
  return remove('records', id);
}

// ---------- 图片 ----------

export function getPhoto(id) {
  return get('photos', id);
}

export function savePhoto(photo) {
  return put('photos', photo);
}

export function deletePhoto(id) {
  return remove('photos', id);
}

// ---------- 设置 ----------

export async function getMeta(key, fallback = null) {
  const item = await get('meta', key);
  return item ? item.value : fallback;
}

export function setMeta(key, value) {
  return put('meta', { key, value });
}

// ---------- 存储占用 ----------

export async function storageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const e = await navigator.storage.estimate();
      return { usage: e.usage || 0, quota: e.quota || 0 };
    } catch {
      return { usage: 0, quota: 0 };
    }
  }
  return { usage: 0, quota: 0 };
}
