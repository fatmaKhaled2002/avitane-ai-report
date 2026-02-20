
import { ProcessedDocument } from "../types";

const DB_NAME = 'MediChronicleDB';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveDocumentsToStorage = async (docs: ProcessedDocument[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  // Clear existing first to sync
  store.clear();

  for (const doc of docs) {
    // We store the File object directly in IndexedDB. 
    // We strip the previewUrl as it becomes invalid on refresh.
    const { previewUrl, ...docToSave } = doc;
    store.put(docToSave);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const loadDocumentsFromStorage = async (): Promise<ProcessedDocument[]> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const docs = request.result as (Omit<ProcessedDocument, 'previewUrl'> & { previewUrl?: string })[];
      // Re-generate preview URLs for the UI
      const processed = docs.map(doc => ({
        ...doc,
        previewUrl: URL.createObjectURL(doc.file)
      })) as ProcessedDocument[];
      resolve(processed);
    };
    request.onerror = () => reject(request.error);
  });
};

export const removeDocumentFromStorage = async (id: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(id);
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const clearDocumentsStorage = async (): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};
