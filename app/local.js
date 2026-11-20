// ===== Stand-alone (outside Claude) storage: IndexedDB-backed db, local image assets, browser downloads
const LOCAL = (() => {
  if (window.claude && window.claude.use) return null;
  const DBN = "liftplan-studio", ST = "docs";
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DBN, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(ST, mode); const s = t.objectStore(ST); const out = fn(s); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || { code: "quota_exceeded" }); }); };
  const listeners = {};
  async function readColl(coll) {
    const d = await open();
    return new Promise((res, rej) => {
      const out = [], t = d.transaction(ST, "readonly"), req = t.objectStore(ST).openCursor(IDBKeyRange.bound(coll + "/", coll + "/￿"));
      req.onsuccess = () => { const c = req.result; if (c) { const id = c.key.slice(coll.length + 1); const v = c.value; out.push({ id, data: () => v }); c.continue(); } else res(out); };
      req.onerror = () => rej(req.error);
    });
  }
  async function notify(coll) { const docs = await readColl(coll); (listeners[coll] || []).forEach(cb => { try { cb({ docs }); } catch (e) { console.warn(e); } }); }
  const db = {
    collection: coll => ({ onSnapshot: (cb, err) => { (listeners[coll] = listeners[coll] || []).push(cb); readColl(coll).then(docs => cb({ docs })).catch(e => err && err(e)); return () => { listeners[coll] = listeners[coll].filter(f => f !== cb); }; } }),
    doc: path => {
      const coll = path.slice(0, path.lastIndexOf("/"));
      return {
        set: async v => { await tx("readwrite", s => s.put(JSON.parse(JSON.stringify(v)), path)); notify(coll); },
        delete: async () => { await tx("readwrite", s => s.delete(path)); notify(coll); },
        get: async () => { const v = await tx("readonly", s => s.get(path)); return { exists: v !== undefined, data: () => v }; }
      };
    }
  };
  const fileToDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  const assets = { upload: async f => { const url = await fileToDataURL(f); return { id: "local", url }; } };
  const downloads = {
    save: async ({ filename, data, mimeType }) => {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || "application/octet-stream" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }
  };
  return { db, assets, downloads, readColl };
})();
