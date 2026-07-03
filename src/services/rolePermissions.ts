import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import {
  DEFAULT_ROLE_PERMISSIONS,
  type ModulePermissionMap,
} from '../constants/permissions';
import { CompanyRole, type CompanyRole as CompanyRoleType } from '../constants/roles';
import { nowUtc, prepareDatesForFirestore } from '../utils/firestoreDates';
import type { CompanyRoleDefinition } from '../types';

const COLLECTION = 'companyRoles';

export function getRoleDocId(companyId: string, role: CompanyRoleType): string {
  return `${companyId}_${role}`;
}

export const rolePermissionsService = {
  async get(companyId: string, role: CompanyRoleType): Promise<CompanyRoleDefinition | null> {
    const snap = await getDoc(doc(db, COLLECTION, getRoleDocId(companyId, role)));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      companyId: String(data.companyId ?? companyId),
      role,
      permissions: (data.permissions ?? DEFAULT_ROLE_PERMISSIONS[role]) as ModulePermissionMap,
      updatedAt: data.updatedAt?.toDate?.() ?? nowUtc(),
    };
  },

  async getForMember(
    companyId: string,
    role: CompanyRoleType | undefined
  ): Promise<ModulePermissionMap | null> {
    if (!role) return null;
    if (role === CompanyRole.ADMIN) return DEFAULT_ROLE_PERMISSIONS[CompanyRole.ADMIN];
    const definition = await this.get(companyId, role);
    return definition?.permissions ?? DEFAULT_ROLE_PERMISSIONS[role];
  },

  async seedDefaults(companyId: string): Promise<void> {
    const batch = writeBatch(db);
    const roles: CompanyRoleType[] = [
      CompanyRole.ADMIN,
      CompanyRole.MANAGER,
      CompanyRole.VIEWER,
      CompanyRole.ACCOUNTANT,
    ];
    const now = nowUtc();

    for (const role of roles) {
      const ref = doc(db, COLLECTION, getRoleDocId(companyId, role));
      batch.set(
        ref,
        prepareDatesForFirestore({
          companyId,
          role,
          permissions: DEFAULT_ROLE_PERMISSIONS[role],
          updatedAt: now,
        })
      );
    }

    await batch.commit();
  },

  /** Create any missing non-admin role permission docs (legacy companies). */
  async ensureDefaults(companyId: string): Promise<void> {
    const roles: CompanyRoleType[] = [
      CompanyRole.MANAGER,
      CompanyRole.VIEWER,
      CompanyRole.ACCOUNTANT,
    ];
    const now = nowUtc();

    await Promise.all(
      roles.map(async (role) => {
        const existing = await this.get(companyId, role);
        if (existing) return;
        await setDoc(
          doc(db, COLLECTION, getRoleDocId(companyId, role)),
          prepareDatesForFirestore({
            companyId,
            role,
            permissions: DEFAULT_ROLE_PERMISSIONS[role],
            updatedAt: now,
          })
        );
      })
    );
  },

  async update(
    companyId: string,
    role: CompanyRoleType,
    permissions: ModulePermissionMap
  ): Promise<void> {
    if (role === CompanyRole.ADMIN) {
      throw new Error('Admin permissions cannot be changed');
    }
    await setDoc(
      doc(db, COLLECTION, getRoleDocId(companyId, role)),
      prepareDatesForFirestore({
        companyId,
        role,
        permissions,
        updatedAt: nowUtc(),
      })
    );
  },
};
