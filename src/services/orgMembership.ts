import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import type { OrgMember } from '../models/orgMember';
import { OrgRole } from '../models/org';
import { convertTimestamps, nowUtc, prepareDatesForFirestore } from '../utils/firestoreDates';

const COLLECTION = 'orgMembers';

export function getOrgMemberDocId(orgId: string, userId: string): string {
  return `${orgId}_${userId}`;
}

function mapMember(docId: string, data: Record<string, unknown>): OrgMember {
  const converted = convertTimestamps<Record<string, unknown>>(data);
  return {
    id: docId,
    orgId: String(converted.orgId ?? ''),
    userId: String(converted.userId ?? ''),
    email: String(converted.email ?? ''),
    displayName: converted.displayName ? String(converted.displayName) : undefined,
    role: converted.role === OrgRole.MEMBER ? OrgRole.MEMBER : OrgRole.ADMIN,
    status: converted.status === 'disabled' ? 'disabled' : 'active',
    createdBy: converted.createdBy ? String(converted.createdBy) : undefined,
    updatedBy: converted.updatedBy ? String(converted.updatedBy) : undefined,
    createdAt: converted.createdAt instanceof Date ? converted.createdAt : nowUtc(),
    updatedAt: converted.updatedAt instanceof Date ? converted.updatedAt : nowUtc(),
  };
}

export const orgMembershipService = {
  async get(orgId: string, userId: string): Promise<OrgMember | null> {
    const snap = await getDoc(doc(db, COLLECTION, getOrgMemberDocId(orgId, userId)));
    if (!snap.exists()) return null;
    return mapMember(snap.id, snap.data() as Record<string, unknown>);
  },

  async createAdmin(orgId: string, userId: string, email: string, displayName: string): Promise<OrgMember> {
    const now = nowUtc();
    const member: OrgMember = {
      id: getOrgMemberDocId(orgId, userId),
      orgId,
      userId,
      email: email.toLowerCase(),
      displayName,
      role: OrgRole.ADMIN,
      status: 'active',
      createdBy: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(
      doc(db, COLLECTION, member.id),
      prepareDatesForFirestore(member as unknown as Record<string, unknown>)
    );
    return member;
  },

  async ensureMember(
    orgId: string,
    userId: string,
    email: string,
    displayName?: string,
    bootstrapCompanyId?: string
  ): Promise<OrgMember> {
    const existing = await this.get(orgId, userId);
    if (existing) return existing;

    const now = nowUtc();
    const member: OrgMember & { bootstrapCompanyId?: string } = {
      id: getOrgMemberDocId(orgId, userId),
      orgId,
      userId,
      email: email.toLowerCase(),
      displayName,
      role: OrgRole.MEMBER,
      status: 'active',
      createdBy: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now,
      ...(bootstrapCompanyId ? { bootstrapCompanyId } : {}),
    };
    await setDoc(
      doc(db, COLLECTION, member.id),
      prepareDatesForFirestore(member as unknown as Record<string, unknown>)
    );
    return member;
  },

  async listForUser(userId: string): Promise<OrgMember[]> {
    const q = query(collection(db, COLLECTION), where('userId', '==', userId), where('status', '==', 'active'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((memberDoc) =>
      mapMember(memberDoc.id, memberDoc.data() as Record<string, unknown>)
    );
  },
};
