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

const REPAIRABLE_ROLES: CompanyRoleType[] = [
  CompanyRole.MANAGER,
  CompanyRole.VIEWER,
  CompanyRole.ACCOUNTANT,
];

export function getRoleDocId(companyId: string, role: CompanyRoleType): string {
  return `${companyId}_${role}`;
}

function mergeWithDefaults(
  role: CompanyRoleType,
  stored?: ModulePermissionMap | null
): ModulePermissionMap {
  return {
    ...DEFAULT_ROLE_PERMISSIONS[role],
    ...(stored ?? {}),
  };
}

function permissionsNeedRepair(role: CompanyRoleType, stored?: ModulePermissionMap | null): boolean {
  if (!stored) return true;
  return Object.keys(DEFAULT_ROLE_PERMISSIONS[role]).some((key) => !(key in stored));
}

export const rolePermissionsService = {
  async get(companyId: string, role: CompanyRoleType): Promise<CompanyRoleDefinition | null> {
    let snap;
    try {
      snap = await getDoc(doc(db, COLLECTION, getRoleDocId(companyId, role)));
    } catch {
      return null;
    }
    if (!snap.exists()) return null;
    const data = snap.data();
    const stored = (data.permissions ?? null) as ModulePermissionMap | null;
    return {
      id: snap.id,
      companyId: String(data.companyId ?? companyId),
      role,
      permissions: mergeWithDefaults(role, stored),
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

  /** Create or repair non-admin role permission docs (legacy / incomplete companies). */
  async ensureDefaults(companyId: string): Promise<void> {
    const now = nowUtc();

    await Promise.all(
      REPAIRABLE_ROLES.map(async (role) => {
        const ref = doc(db, COLLECTION, getRoleDocId(companyId, role));
        const snap = await getDoc(ref);
        const stored = snap.exists()
          ? ((snap.data().permissions ?? null) as ModulePermissionMap | null)
          : null;

        if (!permissionsNeedRepair(role, stored)) return;

        await setDoc(
          ref,
          prepareDatesForFirestore({
            companyId,
            role,
            permissions: mergeWithDefaults(role, stored),
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
