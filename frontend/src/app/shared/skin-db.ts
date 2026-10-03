/** An uploaded skin pack exactly as the user gave it; it's unpacked again on every start. */
export interface StoredSkinPack {
  id: string;
  fileName: string;
  zip: Blob;
  addedAt: string;
  /** What the user calls this Pimpek; without it, the pack's own name. */
  name?: string;
}

const DB_NAME = 'pimpek';
const STORE = 'skins';

/** Zips are too big for localStorage, so skin packs live in IndexedDB. */
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export const skinDb = {
  all: () => run<StoredSkinPack[]>('readonly', (store) => store.getAll()),
  get: (id: string) => run<StoredSkinPack | undefined>('readonly', (store) => store.get(id)),
  put: (pack: StoredSkinPack) => run('readwrite', (store) => store.put(pack)),
  delete: (id: string) => run('readwrite', (store) => store.delete(id)),
  clear: () => run('readwrite', (store) => store.clear()),
};
