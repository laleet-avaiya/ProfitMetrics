import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { nowUtc, prepareDatesForFirestore } from '../utils/firestoreDates';

const COLLECTION = 'userDirectory';

function directoryDocId(email: string): string {
  return email.trim().toLowerCase();
}

export const userDirectoryService = {
  async hasAccount(email: string): Promise<boolean> {
    const snap = await getDoc(doc(db, COLLECTION, directoryDocId(email)));
    return snap.exists();
  },

  async register(email: string): Promise<void> {
    const normalized = directoryDocId(email);
    await setDoc(
      doc(db, COLLECTION, normalized),
      prepareDatesForFirestore({ email: normalized, createdAt: nowUtc() })
    );
  },

  /** Backfill directory entry for users who signed up before this feature existed. */
  async registerIfMissing(email: string): Promise<void> {
    const normalized = directoryDocId(email);
    const ref = doc(db, COLLECTION, normalized);
    const snap = await getDoc(ref);
    if (snap.exists()) return;
    await setDoc(ref, prepareDatesForFirestore({ email: normalized, createdAt: nowUtc() }));
  },
};
