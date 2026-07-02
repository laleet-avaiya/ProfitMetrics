import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile } from '../types';
import { convertTimestamps, nowUtc, prepareDatesForFirestore } from '../utils/firestoreDates';

const COLLECTION = 'users';

export const userProfileService = {
  async get(userId: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(db, COLLECTION, userId));
    if (!snap.exists()) return null;
    const data = convertTimestamps<Record<string, unknown>>(snap.data());
    return {
      id: snap.id,
      email: String(data.email ?? ''),
      displayName: data.displayName ? String(data.displayName) : undefined,
      activeCompanyId: String(data.activeCompanyId ?? ''),
      createdAt: data.createdAt instanceof Date ? data.createdAt : nowUtc(),
      updatedAt: data.updatedAt instanceof Date ? data.updatedAt : nowUtc(),
    };
  },

  async create(userId: string, email: string, activeCompanyId: string): Promise<UserProfile> {
    const now = nowUtc();
    const profile: UserProfile = {
      id: userId,
      email: email.toLowerCase(),
      activeCompanyId,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, COLLECTION, userId), prepareDatesForFirestore(profile as unknown as Record<string, unknown>));
    return profile;
  },

  async setActiveCompany(userId: string, activeCompanyId: string): Promise<void> {
    await updateDoc(
      doc(db, COLLECTION, userId),
      prepareDatesForFirestore({ activeCompanyId, updatedAt: nowUtc() })
    );
  },
};
