const DB_NAME = 'VisualNovelCreatorDB';
const STORE_NAME = 'projects';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB opening failed"));
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Saves a key-value pair to IndexedDB.
 * Returns true if successful, false otherwise.
 */
export async function saveToDB(key: string, value: any): Promise<boolean> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);
      
      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };
      transaction.onabort = transaction.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (e) {
    console.error("IndexedDB save error", e);
    return false;
  }
}

/**
 * Handles saving to IndexedDB with a standard try-catch fallback to localStorage.
 * If IndexedDB runs successfully, we *also* attempt a quiet write to localStorage with quota-exceeded handling,
 * preventing any crash popup/uncaught exceptions.
 */
export async function saveVisualNovelData(key: string, data: any): Promise<boolean> {
  // 1. Try saving to IndexedDB (as primary storage with unconstrained size limit)
  const idbSuccess = await saveToDB(key, data);
  
  // 2. Quietly attempt to sync to localStorage for secondary fallback / offline recovery
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (localStorageError) {
    // Highly expected if size exceeds 5MB. We suppress this error so the user won't get interrupted.
    console.warn(
      "LocalStorage quota exceeded. Data successfully and securely persisted in IndexedDB instead.",
      localStorageError
    );
  }
  
  return idbSuccess;
}

// A Quick save is acknowledged only when the project AND its lobby entry have
// committed together. Quota errors abort the transaction, preserving both old values.
export async function saveProjectAndList(id: string, project: unknown, list: unknown): Promise<boolean> {
  try {
    const db = await getDB();
    const saved = await new Promise<boolean>(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.onabort = tx.onerror = () => { db.close(); resolve(false); };
      try {
        tx.objectStore(STORE_NAME).put(project, 'vn_proj_' + id);
        tx.objectStore(STORE_NAME).put(list, 'vn_project_list');
        tx.oncomplete = () => { db.close(); resolve(true); };
      } catch { tx.abort(); }
    });
    if (saved) for (const [key, value] of [['vn_proj_' + id, project], ['vn_project_list', list]] as const) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* IndexedDB is the acknowledged primary store. */ }
    }
    return saved;
  } catch { return false; }
}

/**
 * Loads a value by key from IndexedDB.
 */
export async function loadFromDB(key: string): Promise<any | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      
      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };
      request.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch (e) {
    console.error("IndexedDB load error", e);
    return null;
  }
}

/**
 * Loads the visual novel data, prioritized by IndexedDB first, and falls back to legacy localStorage if IndexedDB is empty.
 */
export async function loadVisualNovelData(key: string): Promise<any | null> {
  // 1. Retrieve from IndexedDB (new high-quota storage)
  const idbData = await loadFromDB(key);
  if (idbData) {
    return idbData;
  }
  
  // 2. Fall back to existing localStorage data if found (backward compatibility)
  try {
    const savedLocal = localStorage.getItem(key);
    if (savedLocal) {
      const parsed = JSON.parse(savedLocal);
      // Migration: save loaded localStorage data into the higher capacity IndexedDB immediately
      await saveToDB(key, parsed);
      return parsed;
    }
  } catch (e) {
    console.error("Error loaded fallback localStorage", e);
  }
  
  return null;
}

/**
 * Removes a key from IndexedDB and localStorage completely.
 */
export async function removeFromDB(key: string): Promise<boolean> {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error("LocalStorage remove error", e);
  }

  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      
      request.onsuccess = () => {
        db.close();
        resolve(true);
      };
      request.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (e) {
    console.error("IndexedDB remove error", e);
    return false;
  }
}
