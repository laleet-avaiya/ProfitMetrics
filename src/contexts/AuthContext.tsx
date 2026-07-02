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
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { appendAuditLog, auditCompanyChangedKeys } from '../services/auditLog';
import { membershipService } from '../services/membership';
import { userProfileService } from '../services/userProfile';
import {
  convertTimestamps,
  fromFirestoreTimestamp,
  nowUtc,
  prepareDatesForFirestore,
} from '../utils/firestoreDates';
import { AuthContext } from './AuthContextInstance';
import type { AuthContextType, SignUpCompanyDetails } from './AuthContext.types';
import type { Company, CompanyMember } from '../types';
import {
  BusinessCountry,
  countryDefaultsForCompany,
  getCountryProfile,
  isBusinessCountry,
} from '../constants/countries';
import { DEFAULT_MARKETPLACES, normalizeMarketplaceList } from '../constants/platforms';
import { DEFAULT_AI_MESSAGE_QUOTA } from '../constants/aiAssistant';

const COMPANY_COLLECTION = 'companies';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [membership, setMembership] = useState<CompanyMember | null>(null);
  const [loading, setLoading] = useState(true);

  function getDefaultSubscription(): { start: Date; end: Date } {
    const start = nowUtc();
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  function mapCompanyDoc(id: string, data: Record<string, unknown>): Company {
    const converted = convertTimestamps<Record<string, unknown>>(data);
    const country = isBusinessCountry(String(converted.country ?? ''))
      ? (converted.country as BusinessCountry)
      : BusinessCountry.UAE;
    const profile = getCountryProfile(country);

    return {
      id,
      ownerId: String(converted.ownerId ?? ''),
      name: String(converted.name ?? ''),
      country,
      currency: (converted.currency as string) ?? profile.currency,
      timezone: (converted.timezone as string) ?? profile.timezone,
      defaultTaxType: (converted.defaultTaxType as Company['defaultTaxType']) ?? profile.defaultTaxType,
      defaultTaxMode: (converted.defaultTaxMode as Company['defaultTaxMode']) ?? profile.defaultTaxMode,
      defaultTaxPercentage: Number(converted.defaultTaxPercentage ?? profile.defaultTaxPercentage),
      marketplaces: Array.isArray(converted.marketplaces)
        ? normalizeMarketplaceList(converted.marketplaces as string[])
        : undefined,
      trn: converted.trn as string | undefined,
      address: converted.address as string | undefined,
      phone: converted.phone as string | undefined,
      phone2: converted.phone2 as string | undefined,
      email: converted.email as string | undefined,
      logo: converted.logo as string | undefined,
      subscriptionStart: fromFirestoreTimestamp(converted.subscriptionStart),
      subscriptionEnd: fromFirestoreTimestamp(converted.subscriptionEnd),
      termsAcceptedAt: fromFirestoreTimestamp(converted.termsAcceptedAt),
      usagePolicyAcceptedAt: fromFirestoreTimestamp(converted.usagePolicyAcceptedAt),
      termsVersion: converted.termsVersion as string | undefined,
      legalAcceptedByUserId: converted.legalAcceptedByUserId as string | undefined,
      aiMessageQuota:
        typeof converted.aiMessageQuota === 'number'
          ? converted.aiMessageQuota
          : DEFAULT_AI_MESSAGE_QUOTA,
      aiMessagesUsed:
        typeof converted.aiMessagesUsed === 'number' ? converted.aiMessagesUsed : 0,
      createdAt: fromFirestoreTimestamp(converted.createdAt) ?? nowUtc(),
      updatedAt: fromFirestoreTimestamp(converted.updatedAt) ?? nowUtc(),
    };
  }

  const loadCompany = async (companyId: string): Promise<Company | null> => {
    try {
      const companyRef = doc(db, COMPANY_COLLECTION, companyId);
      const companyDoc = await getDoc(companyRef);
      if (!companyDoc.exists()) return null;

      const data = companyDoc.data();
      let subStart = data.subscriptionStart?.toDate?.();
      let subEnd = data.subscriptionEnd?.toDate?.();
      if (subStart == null || subEnd == null) {
        const def = getDefaultSubscription();
        subStart = subStart ?? def.start;
        subEnd = subEnd ?? def.end;
        await updateDoc(
          companyRef,
          prepareDatesForFirestore({
            subscriptionStart: subStart,
            subscriptionEnd: subEnd,
            updatedAt: nowUtc(),
          })
        );
      }
      const country = isBusinessCountry(data.country) ? data.country : BusinessCountry.UAE;
      const mapped = mapCompanyDoc(companyDoc.id, { ...data, country } as Record<string, unknown>);
      setCompany(mapped);
      return mapped;
    } catch (error) {
      console.error('Error loading company:', error);
      return null;
    }
  };

  const loadMembership = async (companyId: string, userId: string): Promise<CompanyMember | null> => {
    try {
      const member = await membershipService.getMember(companyId, userId);
      setMembership(member?.status === 'active' ? member : null);
      return member;
    } catch (error) {
      console.error('Error loading membership:', error);
      setMembership(null);
      return null;
    }
  };

  const loadSession = async (firebaseUser: User): Promise<void> => {
    const email = firebaseUser.email ?? '';
    await membershipService.acceptPendingInvites(firebaseUser.uid, email);

    const memberships = await membershipService.listMembershipsForUser(firebaseUser.uid);
    if (memberships.length === 0) {
      setCompany(null);
      setMembership(null);
      return;
    }

    let profile = await userProfileService.get(firebaseUser.uid);
    const activeCompanyId =
      profile?.activeCompanyId &&
      memberships.some((member) => member.companyId === profile?.activeCompanyId)
        ? profile.activeCompanyId
        : memberships[0].companyId;

    if (!profile) {
      profile = await userProfileService.create(firebaseUser.uid, email, activeCompanyId);
    } else if (profile.activeCompanyId !== activeCompanyId) {
      await userProfileService.setActiveCompany(firebaseUser.uid, activeCompanyId);
    }

    await loadCompany(activeCompanyId);
    await loadMembership(activeCompanyId, firebaseUser.uid);
  };

  const createCompany = async (
    userId: string,
    email: string,
    details: SignUpCompanyDetails
  ): Promise<void> => {
    const companyId = crypto.randomUUID();
    const now = nowUtc();
    const subscriptionEnd = new Date(now);
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 7);
    const locale = countryDefaultsForCompany(details.country);
    const profile = getCountryProfile(details.country);

    const companyData: Company = {
      id: companyId,
      ownerId: userId,
      name: details.companyName,
      ...locale,
      marketplaces: [...DEFAULT_MARKETPLACES],
      subscriptionStart: now,
      subscriptionEnd,
      aiMessageQuota: DEFAULT_AI_MESSAGE_QUOTA,
      aiMessagesUsed: 0,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(
      doc(db, COMPANY_COLLECTION, companyId),
      prepareDatesForFirestore(companyData as unknown as Record<string, unknown>)
    );
    await membershipService.createAdminMember(companyId, userId, email);
    await userProfileService.create(userId, email, companyId);

    appendAuditLog(companyId, userId, {
      action: 'company.created',
      entityType: 'company',
      entityId: companyId,
      summary: `Company ${details.companyName} created (${profile.label})`,
    });

    setCompany(companyData);
    const member = await membershipService.getMember(companyId, userId);
    setMembership(member);
  };

  const signUp = async (
    email: string,
    password: string,
    details?: SignUpCompanyDetails
  ): Promise<void> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = userCredential.user;

    const accepted = await membershipService.acceptPendingInvites(uid, email);
    if (accepted) {
      await userProfileService.create(uid, email, accepted.companyId);
      await loadSession(userCredential.user);
      return;
    }

    if (!details?.companyName?.trim()) {
      throw new Error('Company name is required unless you were invited to an existing team.');
    }

    await createCompany(uid, email, details);
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
    setCompany(null);
    setMembership(null);
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    if (!user?.email) {
      throw new Error('Email account required to change password');
    }
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
      console.error('Error changing password:', error);
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
    if (!user || !company) {
      throw new Error('User or company not found');
    }

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ) as Partial<Company>;

    const updatePayload = prepareDatesForFirestore({
      ...cleanUpdates,
      updatedAt: nowUtc(),
    });

    await updateDoc(doc(db, COMPANY_COLLECTION, company.id), updatePayload);

    setCompany({
      ...company,
      ...cleanUpdates,
      updatedAt: nowUtc(),
    } as Company);

    appendAuditLog(company.id, user.uid, {
      action: 'company.updated',
      entityType: 'company',
      entityId: company.id,
      summary: 'Company profile updated',
      changedFields: auditCompanyChangedKeys(cleanUpdates as Record<string, unknown>),
    });
  };

  const refreshCompany = async (): Promise<void> => {
    if (!user || !company) return;
    await loadCompany(company.id);
    await loadMembership(company.id, user.uid);
  };

  const setupCompany = async (details: SignUpCompanyDetails): Promise<void> => {
    if (!user?.email) {
      throw new Error('You must be signed in to create a company');
    }

    const memberships = await membershipService.listMembershipsForUser(user.uid);
    if (memberships.length > 0) {
      throw new Error('You already belong to a company');
    }

    await createCompany(user.uid, user.email, details);
  };

  const value: AuthContextType = {
    user,
    company,
    membership,
    loading,
    signUp,
    signIn,
    sendPasswordReset,
    signOut,
    updateCompany,
    changePassword,
    refreshCompany,
    setupCompany,
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await loadSession(firebaseUser);
      } else {
        setCompany(null);
        setMembership(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
