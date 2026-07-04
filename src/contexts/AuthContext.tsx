import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  type User,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { appendAuditLog, auditCompanyChangedKeys } from '../services/auditLog';
import { membershipService } from '../services/membership';
import { rolePermissionsService } from '../services/rolePermissions';
import { userProfileService } from '../services/userProfile';
import { userDirectoryService } from '../services/userDirectory';
import { orgService } from '../services/org';
import { orgMembershipService } from '../services/orgMembership';
import { companyService } from '../services/companyService';
import { nowUtc, prepareDatesForFirestore } from '../utils/firestoreDates';
import { isOrgSubscriptionExpired } from '../utils/subscription';
import { AuthContext } from './AuthContextInstance';
import type { AuthContextType, CreateCompanyDetails, SignUpDetails, UserOrgAccess } from './AuthContext.types';
import type { Company, CompanyMember, Organization, OrgMember, UserProfile } from '../types';
import type { ModulePermissionMap } from '../constants/permissions';
import { OrgRole } from '../models/org';
import { CompanyRole } from '../constants/roles';

const COMPANY_COLLECTION = 'companies';
const ORG_COLLECTION = 'orgs';

/** One org-membership row per org; bootstrap from the first company in that org. */
async function syncMissingOrgMemberships(
  userId: string,
  email: string,
  companies: Company[],
  displayName: string | undefined,
  existingOrgMemberships?: OrgMember[]
): Promise<OrgMember[]> {
  const memberships =
    existingOrgMemberships ?? (await orgMembershipService.listForUser(userId));
  const memberOrgIds = new Set(memberships.map((m) => m.orgId));
  const bootstrapByOrg = new Map<string, string>();

  for (const company of companies) {
    if (!memberOrgIds.has(company.orgId) && !bootstrapByOrg.has(company.orgId)) {
      bootstrapByOrg.set(company.orgId, company.id);
    }
  }

  if (bootstrapByOrg.size === 0) return memberships;

  await Promise.all(
    [...bootstrapByOrg.entries()].map(([orgId, companyId]) =>
      orgMembershipService
        .ensureMember(orgId, userId, email, displayName, companyId)
        .catch((err) => {
          console.error('Failed to sync org membership for company:', companyId, err);
        })
    )
  );

  return orgMembershipService.listForUser(userId);
}

async function loadAccessibleOrgs(
  memberships: OrgMember[],
  companies: Company[]
): Promise<UserOrgAccess[]> {
  const results = await Promise.all(
    memberships.map(async (membership) => {
      try {
        const orgDoc = await orgService.get(membership.orgId);
        if (!orgDoc) return null;
        return {
          org: orgDoc,
          membership,
          companyCount: companies.filter((c) => c.orgId === membership.orgId).length,
        };
      } catch (err) {
        console.error('Failed to load organization:', membership.orgId, err);
        return null;
      }
    })
  );

  return results
    .filter((entry): entry is UserOrgAccess => entry != null)
    .sort((a, b) => a.org.name.localeCompare(b.org.name));
}

function resolveActiveOrgId(
  userProfile: UserProfile,
  orgMemberships: OrgMember[],
  companies: Company[],
  accessibleOrgs: UserOrgAccess[]
): { orgId: string | undefined; autoSwitchedFromExpired: boolean } {
  const isKnownOrg = (orgId: string) =>
    orgMemberships.some((m) => m.orgId === orgId) ||
    companies.some((c) => c.orgId === orgId);

  let orgId =
    userProfile.activeOrgId && isKnownOrg(userProfile.activeOrgId)
      ? userProfile.activeOrgId
      : orgMemberships[0]?.orgId ?? companies[0]?.orgId;

  if (!orgId) return { orgId: undefined, autoSwitchedFromExpired: false };

  const current = accessibleOrgs.find((entry) => entry.org.id === orgId);
  if (current && isOrgSubscriptionExpired(current.org)) {
    const fallback = accessibleOrgs.find((entry) => !isOrgSubscriptionExpired(entry.org));
    if (fallback) {
      return { orgId: fallback.org.id, autoSwitchedFromExpired: true };
    }
  }

  return { orgId, autoSwitchedFromExpired: false };
}

function canOpenCompanyInOrg(
  companyId: string,
  companies: Company[],
  accessibleOrgs: UserOrgAccess[]
): boolean {
  const company = companies.find((c) => c.id === companyId);
  if (!company) return false;
  const orgEntry = accessibleOrgs.find((entry) => entry.org.id === company.orgId);
  if (!orgEntry) return false;
  return !isOrgSubscriptionExpired(orgEntry.org);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [orgMembership, setOrgMembership] = useState<OrgMember | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [membership, setMembership] = useState<CompanyMember | null>(null);
  const [rolePermissions, setRolePermissions] = useState<ModulePermissionMap | null>(null);
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [accessibleOrgs, setAccessibleOrgs] = useState<UserOrgAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const orgRef = useRef(org);
  orgRef.current = org;
  const refreshCompaniesInFlightRef = useRef<Promise<number> | null>(null);

  const loadOrgContext = async (orgId: string, userId: string): Promise<void> => {
    const [loadedOrg, loadedOrgMember] = await Promise.all([
      orgService.get(orgId),
      orgMembershipService.get(orgId, userId),
    ]);
    setOrg(loadedOrg);
    setOrgMembership(loadedOrgMember?.status === 'active' ? loadedOrgMember : null);
  };

  const loadCompanyContext = async (companyId: string, userId: string): Promise<void> => {
    const loadedCompany = await companyService.get(companyId);
    if (!loadedCompany) {
      setCompany(null);
      setMembership(null);
      setRolePermissions(null);
      return;
    }

    const member = await membershipService.getMember(companyId, userId);
    if (!member || member.status !== 'active') {
      setCompany(null);
      setMembership(null);
      setRolePermissions(null);
      return;
    }

    const permissions = await rolePermissionsService.getForMember(companyId, member.role);
    setCompany(loadedCompany);
    setMembership(member);
    setRolePermissions(permissions);

    const orgMember = await orgMembershipService.get(loadedCompany.orgId, userId);
    const canRepairRoles =
      member.role === CompanyRole.ADMIN || orgMember?.role === OrgRole.ADMIN;
    if (canRepairRoles) {
      void rolePermissionsService.ensureDefaults(companyId).catch((err) => {
        console.error('Failed to ensure role permission defaults:', err);
      });
    }

    if (!org || org.id !== loadedCompany.orgId) {
      await loadOrgContext(loadedCompany.orgId, userId);
    }
  };

  const loadSession = async (firebaseUser: User): Promise<void> => {
    const email = firebaseUser.email ?? '';

    try {
      await membershipService.acceptPendingInvites(firebaseUser.uid, email);
    } catch (err) {
      console.error('Failed to accept pending invites:', err);
    }

    let userProfile: UserProfile | null = null;
    try {
      userProfile = await userProfileService.get(firebaseUser.uid);
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }

    let companies: Company[] = [];
    try {
      companies = await companyService.listForUser(firebaseUser.uid);
      setUserCompanies(companies);
    } catch (err) {
      console.error('Failed to list companies:', err);
      setUserCompanies([]);
    }

    let orgMemberships: OrgMember[] = [];
    try {
      orgMemberships = await syncMissingOrgMemberships(
        firebaseUser.uid,
        email,
        companies,
        userProfile?.displayName ?? firebaseUser.displayName ?? undefined
      );
    } catch (err) {
      console.error('Failed to sync org memberships:', err);
    }

    if (!userProfile && orgMemberships.length === 0 && companies.length === 0) {
      setProfile(null);
      setOrg(null);
      setOrgMembership(null);
      setCompany(null);
      setMembership(null);
      setRolePermissions(null);
      setAccessibleOrgs([]);
      return;
    }

    if (!userProfile) {
      const fallbackOrgId = companies[0]?.orgId ?? orgMemberships[0]?.orgId;
      if (!fallbackOrgId) return;
      try {
        userProfile = await userProfileService.create(
          firebaseUser.uid,
          email,
          email.split('@')[0] ?? 'User',
          fallbackOrgId
        );
      } catch (err) {
        console.error('Failed to create user profile:', err);
        return;
      }
    }
    if (!userProfile) return;

    setProfile(userProfile);

    if (email) {
      void userDirectoryService.registerIfMissing(email).catch((err) => {
        console.error('Failed to backfill user directory entry:', err);
      });
    }

    let sessionProfile = userProfile;

    let accessible: UserOrgAccess[] = [];
    try {
      accessible = await loadAccessibleOrgs(orgMemberships, companies);
      setAccessibleOrgs(accessible);
    } catch (err) {
      console.error('Failed to load accessible organizations:', err);
      setAccessibleOrgs([]);
    }

    const { orgId: activeOrgId, autoSwitchedFromExpired } = resolveActiveOrgId(
      sessionProfile,
      orgMemberships,
      companies,
      accessible
    );

    if (activeOrgId) {
      const profileNeedsOrgUpdate =
        sessionProfile.activeOrgId !== activeOrgId || autoSwitchedFromExpired;
      if (profileNeedsOrgUpdate) {
        try {
          await userProfileService.setActiveOrg(firebaseUser.uid, activeOrgId);
          if (autoSwitchedFromExpired) {
            await userProfileService.clearActiveCompany(firebaseUser.uid);
          }
          sessionProfile = {
            ...sessionProfile,
            activeOrgId,
            activeCompanyId: autoSwitchedFromExpired ? undefined : sessionProfile.activeCompanyId,
          };
          setProfile(sessionProfile);
        } catch (err) {
          console.error('Failed to set active org on profile:', err);
        }
      }
      try {
        await loadOrgContext(activeOrgId, firebaseUser.uid);
      } catch (err) {
        console.error('Failed to load org context:', err);
      }
    }

    let activeCompanyId =
      sessionProfile.activeCompanyId &&
      companies.some((c) => c.id === sessionProfile.activeCompanyId)
        ? sessionProfile.activeCompanyId
        : undefined;

    if (
      activeCompanyId &&
      !canOpenCompanyInOrg(activeCompanyId, companies, accessible)
    ) {
      activeCompanyId = undefined;
      try {
        await userProfileService.clearActiveCompany(firebaseUser.uid);
        sessionProfile = { ...sessionProfile, activeCompanyId: undefined };
        setProfile(sessionProfile);
      } catch (err) {
        console.error('Failed to clear expired-org company from profile:', err);
      }
    }

    if (activeCompanyId) {
      try {
        await loadCompanyContext(activeCompanyId, firebaseUser.uid);
      } catch (err) {
        console.error('Failed to load company context:', err);
      }
    } else {
      setCompany(null);
      setMembership(null);
      setRolePermissions(null);
    }
  };

  const signUp = async (email: string, password: string, details: SignUpDetails): Promise<void> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = userCredential.user;
    const normalizedEmail = email.trim().toLowerCase();
    const displayName = details.displayName.trim();

    const accepted = await membershipService.acceptPendingInvites(uid, normalizedEmail);
    if (accepted) {
      const invitedCompany = await companyService.get(accepted.companyId);
      if (invitedCompany) {
        const existingProfile = await userProfileService.get(uid);
        if (!existingProfile) {
          await userProfileService.create(uid, normalizedEmail, displayName, invitedCompany.orgId);
        } else {
          await userProfileService.setActiveOrg(uid, invitedCompany.orgId);
        }
        await userProfileService.setActiveCompany(uid, accepted.companyId);
      }
      try {
        await loadSession(userCredential.user);
      } catch (err) {
        console.error('Failed to load session after invite signup:', err);
        throw new Error(
          'Your account was created, but loading your company failed. Please sign in again.'
        );
      }
      return;
    }

    const createdOrg = await orgService.createForOwner(uid, displayName);
    const createdOrgMember = await orgMembershipService.createAdmin(
      createdOrg.id,
      uid,
      normalizedEmail,
      displayName
    );
    const createdProfile = await userProfileService.create(
      uid,
      normalizedEmail,
      displayName,
      createdOrg.id
    );

    setProfile(createdProfile);
    setOrg(createdOrg);
    setOrgMembership(createdOrgMember);
    setUserCompanies([]);
    setCompany(null);
    setMembership(null);
    setRolePermissions(null);
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
  };

  const signOut = async (): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (uid && company) {
      appendAuditLog(company.id, uid, {
        action: 'auth.sign_out',
        entityType: 'auth',
        summary: 'Signed out',
      });
    }
    await firebaseSignOut(auth);
    setProfile(null);
    setOrg(null);
    setOrgMembership(null);
    setCompany(null);
    setMembership(null);
    setRolePermissions(null);
    setUserCompanies([]);
    setAccessibleOrgs([]);
  };

  const selectCompany = async (companyId: string): Promise<void> => {
    if (!user) throw new Error('Not signed in');
    const target =
      userCompanies.find((c) => c.id === companyId) ?? (await companyService.get(companyId));
    if (!target) throw new Error('Company not found');

    const targetOrg =
      accessibleOrgs.find((entry) => entry.org.id === target.orgId)?.org ??
      (await orgService.get(target.orgId));

    if (!targetOrg || isOrgSubscriptionExpired(targetOrg)) {
      throw new Error(
        'This organization\'s subscription has expired. Switch to another organization or renew to open this company.'
      );
    }

    if (profile?.activeOrgId !== target.orgId) {
      await userProfileService.setActiveOrg(user.uid, target.orgId);
      await loadOrgContext(target.orgId, user.uid);
    }
    await userProfileService.setActiveCompany(user.uid, companyId);
    await loadCompanyContext(companyId, user.uid);
    setProfile((prev) =>
      prev ? { ...prev, activeOrgId: target.orgId, activeCompanyId: companyId } : prev
    );
  };

  const selectOrg = async (orgId: string): Promise<void> => {
    if (!user) throw new Error('Not signed in');

    const hasMembership = accessibleOrgs.some((entry) => entry.org.id === orgId);
    const hasCompany = userCompanies.some((c) => c.orgId === orgId);
    if (!hasMembership && !hasCompany) {
      throw new Error('You do not have access to this organization');
    }

    await userProfileService.setActiveOrg(user.uid, orgId);
    await userProfileService.clearActiveCompany(user.uid);
    await loadOrgContext(orgId, user.uid);
    setProfile((prev) =>
      prev ? { ...prev, activeOrgId: orgId, activeCompanyId: undefined } : prev
    );
    setCompany(null);
    setMembership(null);
    setRolePermissions(null);
  };

  const createCompany = async (details: CreateCompanyDetails): Promise<Company> => {
    if (!user?.email || !org) {
      throw new Error('Organization not found');
    }
    if (orgMembership?.role !== OrgRole.ADMIN) {
      throw new Error('Only organization admins can create companies in this organization');
    }

    const companiesInOrg = userCompanies.filter((c) => c.orgId === org.id).length;
    if (companiesInOrg >= org.companyQuota) {
      throw new Error(`Company limit reached (${org.companyQuota}). Upgrade your plan to add more.`);
    }

    const created = await companyService.create(org.id, user.uid, user.email, details);
    await userProfileService.setActiveCompany(user.uid, created.id);
    const companies = await companyService.listForUser(user.uid);
    setUserCompanies(companies);
    await loadCompanyContext(created.id, user.uid);
    setProfile((prev) => (prev ? { ...prev, activeCompanyId: created.id } : prev));
    return created;
  };

  const createOwnOrganization = async (displayName?: string): Promise<Organization> => {
    if (!user?.email) throw new Error('Not signed in');

    const label =
      displayName?.trim() ||
      profile?.displayName ||
      user.displayName ||
      user.email.split('@')[0] ||
      'User';

    const createdOrg = await orgService.createForOwner(user.uid, label);
    const createdOrgMember = await orgMembershipService.createAdmin(
      createdOrg.id,
      user.uid,
      user.email,
      label
    );

    const existingProfile = await userProfileService.get(user.uid);
    if (!existingProfile) {
      await userProfileService.create(user.uid, user.email, label, createdOrg.id);
    } else {
      await userProfileService.setActiveOrg(user.uid, createdOrg.id);
    }
    await userProfileService.clearActiveCompany(user.uid);

    setProfile((prev) =>
      prev
        ? { ...prev, activeOrgId: createdOrg.id, activeCompanyId: undefined }
        : {
            id: user.uid,
            email: user.email!.toLowerCase(),
            displayName: label,
            activeOrgId: createdOrg.id,
            createdAt: nowUtc(),
            updatedAt: nowUtc(),
          }
    );
    setOrg(createdOrg);
    setOrgMembership(createdOrgMember);
    setCompany(null);
    setMembership(null);
    setRolePermissions(null);

    const companies = await companyService.listForUser(user.uid);
    setUserCompanies(companies);

    const memberships = await orgMembershipService.listForUser(user.uid);
    setAccessibleOrgs(await loadAccessibleOrgs(memberships, companies));

    return createdOrg;
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    if (!user?.email) throw new Error('Email account required to change password');
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      if (company) {
        appendAuditLog(company.id, user.uid, {
          action: 'auth.password_changed',
          entityType: 'auth',
          summary: 'Password changed',
        });
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as { code?: string }).code;
        if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          throw new Error('Current password is incorrect');
        }
        if (code === 'auth/weak-password') {
          throw new Error('New password is too weak. Use at least 6 characters.');
        }
      }
      throw error;
    }
  };

  const updateCompany = async (updates: Partial<Company>): Promise<void> => {
    if (!user || !company) throw new Error('Company not found');

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ) as Partial<Company>;

    await updateDoc(
      doc(db, COMPANY_COLLECTION, company.id),
      prepareDatesForFirestore({ ...cleanUpdates, updatedAt: nowUtc(), updatedBy: user.uid })
    );

    setCompany({ ...company, ...cleanUpdates, updatedAt: nowUtc() } as Company);
    appendAuditLog(company.id, user.uid, {
      action: 'company.updated',
      entityType: 'company',
      entityId: company.id,
      summary: 'Company profile updated',
      changedFields: auditCompanyChangedKeys(cleanUpdates as Record<string, unknown>),
    });
  };

  const updateOrg = async (updates: Partial<Organization>): Promise<void> => {
    if (!user || !org) throw new Error('Organization not found');
    if (orgMembership?.role !== OrgRole.ADMIN) {
      throw new Error('Only organization admins can update organization settings');
    }

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ) as Partial<Organization>;

    await updateDoc(
      doc(db, ORG_COLLECTION, org.id),
      prepareDatesForFirestore({ ...cleanUpdates, updatedAt: nowUtc(), updatedBy: user.uid })
    );
    setOrg({ ...org, ...cleanUpdates, updatedAt: nowUtc() } as Organization);
  };

  const refreshCompanies = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    if (refreshCompaniesInFlightRef.current) {
      return refreshCompaniesInFlightRef.current;
    }

    const run = async (): Promise<number> => {
      const email = user.email ?? '';
      const companies = await companyService.listForUser(user.uid);

      await syncMissingOrgMemberships(
        user.uid,
        email,
        companies,
        profile?.displayName ?? user.displayName ?? undefined
      );

      setUserCompanies(companies);

      const memberships = await orgMembershipService.listForUser(user.uid);
      setAccessibleOrgs(await loadAccessibleOrgs(memberships, companies));

      const activeOrgId =
        profile?.activeOrgId &&
        (memberships.some((m) => m.orgId === profile.activeOrgId) ||
          companies.some((c) => c.orgId === profile.activeOrgId))
          ? profile.activeOrgId
          : memberships[0]?.orgId ?? companies[0]?.orgId;

      const currentOrg = orgRef.current;
      if (activeOrgId && (!currentOrg || currentOrg.id !== activeOrgId)) {
        try {
          await loadOrgContext(activeOrgId, user.uid);
        } catch (err) {
          console.error('Failed to load org context while refreshing companies:', err);
        }
      }

      return companies.length;
    };

    const promise = run();
    refreshCompaniesInFlightRef.current = promise;
    try {
      return await promise;
    } finally {
      if (refreshCompaniesInFlightRef.current === promise) {
        refreshCompaniesInFlightRef.current = null;
      }
    }
  }, [user, profile?.activeOrgId, profile?.displayName]);

  const refreshRolePermissions = async (): Promise<void> => {
    if (!company || !membership) return;
    const permissions = await rolePermissionsService.getForMember(company.id, membership.role);
    setRolePermissions(permissions);
  };

  const refreshSession = async (): Promise<void> => {
    if (!user) return;
    await loadSession(user);
  };

  const value: AuthContextType = {
    user,
    profile,
    org,
    orgMembership,
    company,
    membership,
    rolePermissions,
    userCompanies,
    accessibleOrgs,
    loading,
    signUp,
    signIn,
    sendPasswordReset,
    signOut,
    selectCompany,
    selectOrg,
    createCompany,
    createOwnOrganization,
    updateCompany,
    updateOrg,
    changePassword,
    refreshSession,
    refreshRolePermissions,
    refreshCompanies,
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      try {
        if (firebaseUser) {
          await loadSession(firebaseUser);
        } else {
          setProfile(null);
          setOrg(null);
          setOrgMembership(null);
          setCompany(null);
          setMembership(null);
          setRolePermissions(null);
          setUserCompanies([]);
          setAccessibleOrgs([]);
        }
      } catch (err) {
        console.error('Failed to load auth session:', err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
    // Intentionally mount-only: onAuthStateChanged is the Firebase auth subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
