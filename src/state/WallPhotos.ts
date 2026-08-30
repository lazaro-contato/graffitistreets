import { WALL_PHOTO, type Side } from "../config";

/**
 * Wall photographs the player dropped in, kept on their own machine.
 *
 * Nothing here is uploaded. There is no server to upload to yet, and that is
 * the point rather than a limitation: a photograph of somebody's street can go
 * on the wall today, with nothing to moderate and nobody's copyright to clear,
 * because it never leaves the browser it was dropped into.
 *
 * Every call resolves rather than rejecting. Private windows refuse IndexedDB
 * outright, and a wall that cannot be remembered is still a wall that can be
 * painted — losing the photo on reload is a far better failure than a game
 * that will not start.
 */

const DB_NAME = "graffiti";
const DB_VERSION = 1;
const STORE = "wallPhotos";

/** What is kept per side: the file itself, and how wide one tile of it is. */
export type WallPhoto = {
  blob: Blob;
  tileMeters: number;
};

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      // Some browsers throw here rather than failing the request.
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    // Another tab holding an older version open. Rather than waiting forever,
    // this visit goes without persistence.
    request.onblocked = () => resolve(null);
  });
}

function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return open().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }

        try {
          const transaction = db.transaction(STORE, mode);
          const request = work(transaction.objectStore(STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
          transaction.oncomplete = () => db.close();
        } catch {
          db.close();
          resolve(null);
        }
      }),
  );
}

/** True for a file this is willing to keep. Anything else is refused. */
export function isUsablePhoto(file: File | Blob): boolean {
  return file.type.startsWith("image/") && file.size <= WALL_PHOTO.MAX_BYTES;
}

export function savePhoto(side: Side, photo: WallPhoto): Promise<unknown> {
  return run("readwrite", (store) => store.put(photo, side));
}

export function clearPhoto(side: Side): Promise<unknown> {
  return run("readwrite", (store) => store.delete(side));
}

export async function loadPhoto(side: Side): Promise<WallPhoto | null> {
  const stored = await run<WallPhoto>("readonly", (store) => store.get(side));
  if (!stored || !(stored.blob instanceof Blob)) return null;
  if (typeof stored.tileMeters !== "number" || stored.tileMeters <= 0) {
    return null;
  }
  return stored;
}

/** Both sides at once, for the one read the boot path makes. */
export async function loadPhotos(): Promise<Partial<Record<Side, WallPhoto>>> {
  const [left, right] = await Promise.all([
    loadPhoto("left"),
    loadPhoto("right"),
  ]);

  const photos: Partial<Record<Side, WallPhoto>> = {};
  if (left) photos.left = left;
  if (right) photos.right = right;
  return photos;
}
