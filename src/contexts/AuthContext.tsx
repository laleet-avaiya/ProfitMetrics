import { useState, useEffect, type ReactNode } from 'react';
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
import { orgService } from '../services/org';
import { orgMembershipService } from '../services/orgMembership';
import { companyService } from '../services/companyService';
import { nowUtc, prepareDatesForFirestore } from '../utils/firestoreDates';
import { AuthContext } from './AuthContextInstance';
import type { AuthContextType, CreateCompanyDetails, SignUpDetails } from './AuthContext.types';
import type { Company, CompanyMember, Organization, OrgMember, UserProfile } from '../types';
import type { ModulePermissionMap } from '../constants/permissions';
import { OrgRole } from '../models/org';
import { CompanyRole } from '../constants/roles';

const COMPANY_COLLECTION = 'companies';
const ORG_COLLECTION = 'orgs';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [orgMembership, setOrgMembership] = useState<OrgMember | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [membership, setMembership] = useState<CompanyMember | null>(null);
  const [rolePermissions, setRolePermissions] = useState<ModulePermissionMap | null>(null);
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

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

    if (member.role === CompanyRole.ADMIN) {
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
    await membershipService.acceptPendingInvites(firebaseUser.uid, email);

    let userProfile = await userProfileService.get(firebaseUser.uid);
    const companies = await companyService.listForUser(firebaseUser.uid);
    setUserCompanies(companies);

    const orgMemberships = await orgMembershipService.listForUser(firebaseUser.uid);

    if (!userProfile && orgMemberships.length === 0 && companies.length === 0) {
      setProfile(null);
      setOrg(null);
      setOrgMembership(null);
      setCompany(null);
      setMembership(null);
      setRolePermissions(null);
      return;
    }

    if (!userProfile) {
      const fallbackOrgId = companies[0]?.orgId ?? orgMemberships[0]?.orgId;
      if (!fallbackOrgId) return;
      userProfile = await userProfileService.create(
        firebaseUser.uid,
        email,
        email.split('@')[0] ?? 'User',
        fallbackOrgId
      );
    }
    setProfile(userProfile);

    const activeOrgId =
      userProfile.activeOrgId && (orgMemberships.some((m) => m.orgId === userProfile.activeOrgId) || companies.some((c) => c.orgId === userProfile.activeOrgId))
        ? userProfile.activeOrgId
        : orgMemberships[0]?.orgId ?? companies[0]?.orgId;

    if (activeOrgId) {
      if (userProfile.activeOrgId !== activeOrgId) {
        await userProfileService.setActiveOrg(firebaseUser.uid, activeOrgId);
      }
      await loadOrgContext(activeOrgId, firebaseUser.uid);
    }

    const activeCompanyId =
      userProfile.activeCompanyId &&
      companies.some((c) => c.id === userProfile.activeCompanyId)
        ? userProfile.activeCompanyId
        : undefined;

    if (activeCompanyId) {
      await loadCompanyContext(activeCompanyId, firebaseUser.uid);
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
        await orgMembershipService.ensureMember(
          invitedCompany.orgId,
          uid,
          normalizedEmail,
          displayName,
          accepted.companyId
        );
        const existingProfile = await userProfileService.get(uid);
        if (!existingProfile) {
          await userProfileService.create(uid, normalizedEmail, displayName, invitedCompany.orgId);
        } else {
          await userProfileService.setActiveOrg(uid, invitedCompany.orgId);
        }
        await userProfileService.setActiveCompany(uid, accepted.companyId);
      }
      await loadSession(userCredential.user);
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
  };

  const selectCompany = async (companyId: string): Promise<void> => {
    if (!user) throw new Error('Not signed in');
    await userProfileService.setActiveCompany(user.uid, companyId);
    await loadCompanyContext(companyId, user.uid);
    setProfile((prev) => (prev ? { ...prev, activeCompanyId: companyId } : prev));
  };

  const createCompany = async (details: CreateCompanyDetails): Promise<Company> => {
    if (!user?.email || !org) {
      throw new Error('Organization not found');
    }
    if (orgMembership?.role !== OrgRole.ADMIN) {
      throw new Error('Only organization admins can create companies');
    }

    const created = await companyService.create(org.id, user.uid, user.email, details);
    await userProfileService.setActiveCompany(user.uid, created.id);
    const companies = await companyService.listForUser(user.uid);
    setUserCompanies(companies);
    await loadCompanyContext(created.id, user.uid);
    setProfile((prev) => (prev ? { ...prev, activeCompanyId: created.id } : prev));
    return created;
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

  const refreshCompanies = async (): Promise<void> => {
    if (!user) return;
    const companies = await companyService.listForUser(user.uid);
    setUserCompanies(companies);
  };

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
    loading,
    signUp,
    signIn,
    sendPasswordReset,
    signOut,
    selectCompany,
    createCompany,
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
      }
      setLoading(false);
    });
    return () => unsubscribe();
    // Intentionally mount-only: onAuthStateChanged is the Firebase auth subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
