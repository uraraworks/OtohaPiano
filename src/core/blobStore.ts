// 音声録音メモの Blob 置き場(IndexedDB)。
// メタ情報(名前・長さ)は localStorage 側に置き、ここには実体だけを入れる。
// そうすると一覧表示のたびに IndexedDB を開かずに済む。

const DB_NAME = "otoha";
const DB_VERSION = 1;
const STORE = "audio";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB を開けませんでした"));
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("保存に失敗しました"));
      }),
  );
}

export function putBlob(id: string, blob: Blob): Promise<unknown> {
  return tx("readwrite", (s) => s.put(blob, id));
}

export function getBlob(id: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>("readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>);
}

export function deleteBlob(id: string): Promise<unknown> {
  return tx("readwrite", (s) => s.delete(id));
}
