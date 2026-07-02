import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Organization } from '../models/org';
import { DEFAULT_ORG_COMPANY_QUOTA, ORG_TRIAL_DAYS } from '../constants/org';
import { DEFAULT_AI_MESSAGE_QUOTA } from '../constants/aiAssistant';
import { convertTimestamps, fromFirestoreTimestamp, nowUtc, prepareDatesForFirestore } from '../utils/firestoreDates';

const COLLECTION = 'orgs';

export function getOrgDocId(orgId: string): string {
  return orgId;
}

function mapOrg(id: string, data: Record<string, unknown>): Organization {
  const converted = convertTimestamps<Record<string, unknown>>(data);
  return {
    id,
    name: String(converted.name ?? ''),
    ownerId: String(converted.ownerId ?? ''),
    companyQuota:
      typeof converted.companyQuota === 'number' ? converted.companyQuota : DEFAULT_ORG_COMPANY_QUOTA,
    aiMessageQuota:
      typeof converted.aiMessageQuota === 'number' ? converted.aiMessageQuota : DEFAULT_AI_MESSAGE_QUOTA,
    aiMessagesUsed: typeof converted.aiMessagesUsed === 'number' ? converted.aiMessagesUsed : 0,
    subscriptionStart: fromFirestoreTimestamp(converted.subscriptionStart),
    subscriptionEnd: fromFirestoreTimestamp(converted.subscriptionEnd),
    termsVersion: converted.termsVersion as string | undefined,
    termsAcceptedAt: fromFirestoreTimestamp(converted.termsAcceptedAt),
    usagePolicyAcceptedAt: fromFirestoreTimestamp(converted.usagePolicyAcceptedAt),
    legalAcceptedByUserId: converted.legalAcceptedByUserId as string | undefined,
    createdAt: fromFirestoreTimestamp(converted.createdAt) ?? nowUtc(),
    updatedAt: fromFirestoreTimestamp(converted.updatedAt) ?? nowUtc(),
  };
}

export const orgService = {
  async get(orgId: string): Promise<Organization | null> {
    const snap = await getDoc(doc(db, COLLECTION, orgId));
    if (!snap.exists()) return null;
    return mapOrg(snap.id, snap.data() as Record<string, unknown>);
  },

  async createForOwner(userId: string, displayName: string): Promise<Organization> {
    const orgId = crypto.randomUUID();
    const now = nowUtc();
    const subscriptionEnd = new Date(now);
    subscriptionEnd.setDate(subscriptionEnd.getDate() + ORG_TRIAL_DAYS);

    const org: Organization = {
      id: orgId,
      name: `${displayName.trim()}'s Organization`,
      ownerId: userId,
      companyQuota: DEFAULT_ORG_COMPANY_QUOTA,
      aiMessageQuota: DEFAULT_AI_MESSAGE_QUOTA,
      aiMessagesUsed: 0,
      subscriptionStart: now,
      subscriptionEnd,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(
      doc(db, COLLECTION, orgId),
      prepareDatesForFirestore(org as unknown as Record<string, unknown>)
    );
    return org;
  },

  async update(orgId: string, updates: Partial<Organization>): Promise<void> {
    await updateDoc(
      doc(db, COLLECTION, orgId),
      prepareDatesForFirestore({ ...updates, updatedAt: nowUtc() })
    );
  },

  async countCompanies(orgId: string): Promise<number> {
    const q = query(collection(db, 'companies'), where('orgId', '==', orgId));
    const snapshot = await getDocs(q);
    return snapshot.size;
  },
};
