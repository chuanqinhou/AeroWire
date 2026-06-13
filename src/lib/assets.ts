const ASSET_DB_NAME = "aerowire.assets.v1";
const ASSET_STORE_NAME = "images";
const ASSET_URI_PREFIX = "asset://";

export function isAssetUri(src: string) {
  return src.startsWith(ASSET_URI_PREFIX);
}

export function getAssetIdFromUri(src: string) {
  return src.slice(ASSET_URI_PREFIX.length);
}

export function createAssetUri(assetId: string) {
  return `${ASSET_URI_PREFIX}${assetId}`;
}

export function isDataUrl(src: string) {
  return src.startsWith("data:");
}

function openAssetDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ASSET_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ASSET_STORE_NAME)) {
        db.createObjectStore(ASSET_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putImageAsset(assetId: string, dataUrl: string) {
  const db = await openAssetDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE_NAME, "readwrite");
    transaction.objectStore(ASSET_STORE_NAME).put(dataUrl, assetId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function getImageAsset(assetId: string) {
  const db = await openAssetDb();
  const result = await new Promise<string | null>((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE_NAME, "readonly");
    const request = transaction.objectStore(ASSET_STORE_NAME).get(assetId);
    request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}
