import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type { CompanyInvite, CompanyMember } from '../types';
import { CompanyRole, type CompanyRole as CompanyRoleType } from '../constants/roles';
import { convertTimestamps, nowUtc, prepareDatesForFirestore } from '../utils/firestoreDates';
import { orgMembershipService } from './orgMembership';

const COLLECTION_MEMBERS = 'companyMembers';
const COLLECTION_INVITES = 'companyInvites';

export function getMemberDocId(companyId: string, userId: string): string {
  return `${companyId}_${userId}`;
}

function mapMember(docId: string, data: Record<string, unknown>): CompanyMember {
  const converted = convertTimestamps<Record<string, unknown>>(data);
  return {
    id: docId,
    companyId: String(converted.companyId ?? ''),
    userId: String(converted.userId ?? ''),
    email: String(converted.email ?? ''),
    displayName: converted.displayName ? String(converted.displayName) : undefined,
    role: (converted.role as CompanyRoleType) ?? CompanyRole.VIEWER,
    status: converted.status === 'disabled' ? 'disabled' : 'active',
    invitedBy: converted.invitedBy ? String(converted.invitedBy) : undefined,
    createdAt: converted.createdAt instanceof Date ? converted.createdAt : nowUtc(),
    updatedAt: converted.updatedAt instanceof Date ? converted.updatedAt : nowUtc(),
  };
}

function mapInvite(docId: string, data: Record<string, unknown>): CompanyInvite {
  const converted = convertTimestamps<Record<string, unknown>>(data);
  const status = converted.status;
  return {
    id: docId,
    companyId: String(converted.companyId ?? ''),
    email: String(converted.email ?? ''),
    role: (converted.role as CompanyRoleType) ?? CompanyRole.VIEWER,
    invitedBy: String(converted.invitedBy ?? ''),
    status: status === 'accepted' || status === 'revoked' ? status : 'pending',
    createdAt: converted.createdAt instanceof Date ? converted.createdAt : nowUtc(),
    updatedAt: converted.updatedAt instanceof Date ? converted.updatedAt : nowUtc(),
  };
}

export const membershipService = {
  async getMember(companyId: string, userId: string): Promise<CompanyMember | null> {
    const snap = await getDoc(doc(db, COLLECTION_MEMBERS, getMemberDocId(companyId, userId)));
    if (!snap.exists()) return null;
    return mapMember(snap.id, snap.data() as Record<string, unknown>);
  },

  async listMembers(companyId: string): Promise<CompanyMember[]> {
    const q = query(
      collection(db, COLLECTION_MEMBERS),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((memberDoc) =>
      mapMember(memberDoc.id, memberDoc.data() as Record<string, unknown>)
    );
  },

  async listInvites(companyId: string): Promise<CompanyInvite[]> {
    const q = query(
      collection(db, COLLECTION_INVITES),
      where('companyId', '==', companyId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((inviteDoc) =>
      mapInvite(inviteDoc.id, inviteDoc.data() as Record<string, unknown>)
    );
  },

  async createAdminMember(
    companyId: string,
    userId: string,
    email: string
  ): Promise<CompanyMember> {
    const now = nowUtc();
    const member: CompanyMember = {
      id: getMemberDocId(companyId, userId),
      companyId,
      userId,
      email: email.toLowerCase(),
      role: CompanyRole.ADMIN,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(
      doc(db, COLLECTION_MEMBERS, member.id),
      prepareDatesForFirestore(member as unknown as Record<string, unknown>)
    );
    return member;
  },

  async createMemberFromInvite(
    companyId: string,
    userId: string,
    email: string,
    role: CompanyRoleType,
    invitedBy: string,
    inviteId: string
  ): Promise<CompanyMember> {
    const now = nowUtc();
    const member: CompanyMember & { inviteId: string } = {
      id: getMemberDocId(companyId, userId),
      companyId,
      userId,
      email: email.toLowerCase(),
      role,
      status: 'active',
      invitedBy,
      createdAt: now,
      updatedAt: now,
      inviteId,
    };
    await setDoc(
      doc(db, COLLECTION_MEMBERS, member.id),
      prepareDatesForFirestore(member as unknown as Record<string, unknown>)
    );
    return member;
  },

  async inviteMember(
    companyId: string,
    email: string,
    role: CompanyRoleType,
    invitedBy: string
  ): Promise<CompanyInvite> {
    const normalizedEmail = email.trim().toLowerCase();
    const id = crypto.randomUUID();
    const now = nowUtc();
    const invite: CompanyInvite = {
      id,
      companyId,
      email: normalizedEmail,
      role,
      invitedBy,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, COLLECTION_INVITES, id), prepareDatesForFirestore(invite as unknown as Record<string, unknown>));
    return invite;
  },

  async updateMemberRole(
    companyId: string,
    userId: string,
    role: CompanyRoleType
  ): Promise<void> {
    await updateDoc(
      doc(db, COLLECTION_MEMBERS, getMemberDocId(companyId, userId)),
      prepareDatesForFirestore({ role, updatedAt: nowUtc() })
    );
  },

  async removeMember(companyId: string, userId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION_MEMBERS, getMemberDocId(companyId, userId)));
  },

  async revokeInvite(inviteId: string): Promise<void> {
    await updateDoc(
      doc(db, COLLECTION_INVITES, inviteId),
      prepareDatesForFirestore({ status: 'revoked', updatedAt: nowUtc() })
    );
  },

  async acceptPendingInvites(
    userId: string,
    email: string
  ): Promise<{ companyId: string; member: CompanyMember } | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const q = query(
      collection(db, COLLECTION_INVITES),
      where('email', '==', normalizedEmail),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const inviteDoc = snapshot.docs[0];
    const invite = mapInvite(inviteDoc.id, inviteDoc.data() as Record<string, unknown>);
    const member = await this.createMemberFromInvite(
      invite.companyId,
      userId,
      normalizedEmail,
      invite.role,
      invite.invitedBy,
      invite.id
    );
    await updateDoc(
      doc(db, COLLECTION_INVITES, invite.id),
      prepareDatesForFirestore({ status: 'accepted', updatedAt: nowUtc() })
    );

    const companySnap = await getDoc(doc(db, 'companies', invite.companyId));
    const orgId = companySnap.exists()
      ? String((companySnap.data() as Record<string, unknown>).orgId ?? '')
      : '';
    if (orgId) {
      await orgMembershipService.ensureMember(
        orgId,
        userId,
        normalizedEmail,
        undefined,
        invite.companyId
      );
    }

    return { companyId: invite.companyId, member };
  },

  async listMembershipsForUser(userId: string): Promise<CompanyMember[]> {
    const q = query(
      collection(db, COLLECTION_MEMBERS),
      where('userId', '==', userId),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((memberDoc) =>
      mapMember(memberDoc.id, memberDoc.data() as Record<string, unknown>)
    );
  },
};
