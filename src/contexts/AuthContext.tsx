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
  type User
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { appendAuditLog, auditCompanyChangedKeys } from '../services/auditLog';
import {
  convertTimestamps,
  fromFirestoreTimestamp,
  nowUtc,
  prepareDatesForFirestore,
} from '../utils/firestoreDates';
import { AuthContext } from './AuthContextInstance';
import type { AuthContextType } from './AuthContext.types';
import type { SignUpCompanyDetails } from './AuthContext.types';
import type { Company } from '../types';
import {
  BusinessCountry,
  countryDefaultsForCompany,
  getCountryProfile,
  isBusinessCountry,
} from '../constants/countries';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const COMPANY_COLLECTION = 'companies';

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
      ...converted,
      country,
      currency: (converted.currency as string) ?? profile.currency,
      timezone: (converted.timezone as string) ?? profile.timezone,
      defaultTaxType: converted.defaultTaxType ?? profile.defaultTaxType,
      defaultTaxMode: converted.defaultTaxMode ?? profile.defaultTaxMode,
      defaultTaxPercentage: converted.defaultTaxPercentage ?? profile.defaultTaxPercentage,
      subscriptionStart: fromFirestoreTimestamp(converted.subscriptionStart),
      subscriptionEnd: fromFirestoreTimestamp(converted.subscriptionEnd),
      termsAcceptedAt: fromFirestoreTimestamp(converted.termsAcceptedAt),
      usagePolicyAcceptedAt: fromFirestoreTimestamp(converted.usagePolicyAcceptedAt),
      termsVersion: converted.termsVersion as string | undefined,
      legalAcceptedByUserId: converted.legalAcceptedByUserId as string | undefined,
      createdAt: fromFirestoreTimestamp(converted.createdAt) ?? nowUtc(),
      updatedAt: fromFirestoreTimestamp(converted.updatedAt) ?? nowUtc(),
    } as Company;
  }

  // Load company data from Firestore
  const loadCompany = async (userId: string) => {
    try {
      const companyRef = doc(db, COMPANY_COLLECTION, userId);
      const companyDoc = await getDoc(companyRef);
      if (companyDoc.exists()) {
        const data = companyDoc.data();
        let subStart = data.subscriptionStart?.toDate?.();
        let subEnd = data.subscriptionEnd?.toDate?.();
        if (subStart == null || subEnd == null) {
          const def = getDefaultSubscription();
          subStart = subStart ?? def.start;
          subEnd = subEnd ?? def.end;
          const payload = prepareDatesForFirestore({
            subscriptionStart: subStart,
            subscriptionEnd: subEnd,
            updatedAt: nowUtc(),
          });
          await updateDoc(companyRef, payload);
        }
        const country = isBusinessCountry(data.country) ? data.country : BusinessCountry.UAE;
        setCompany(mapCompanyDoc(companyDoc.id, { ...data, country } as Record<string, unknown>));
      }
    } catch (error) {
      console.error('Error loading company:', error);
    }
  };

  // Create company on signup
  const createCompany = async (userId: string, details: SignUpCompanyDetails): Promise<void> => {
    try {
      const now = nowUtc();
      const subscriptionEnd = new Date(now);
      subscriptionEnd.setDate(subscriptionEnd.getDate() + 7);
      const locale = countryDefaultsForCompany(details.country);
      const profile = getCountryProfile(details.country);

      const companyData: Omit<Company, 'id'> = {
        userId,
        name: details.companyName,
        ...locale,
        subscriptionStart: now,
        subscriptionEnd,
        createdAt: now,
        updatedAt: now,
      };

      const payload = prepareDatesForFirestore({
        userId,
        name: details.companyName,
        companyId: userId,
        ...locale,
        subscriptionStart: now,
        subscriptionEnd,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, COMPANY_COLLECTION, userId), payload);

      appendAuditLog(userId, userId, {
        action: 'company.created',
        entityType: 'company',
        entityId: userId,
        summary: `Company ${details.companyName} created (${profile.label})`,
      });

      setCompany({ id: userId, ...companyData } as Company);
    } catch (error) {
      console.error('Error creating company:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, details: SignUpCompanyDetails): Promise<void> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await createCompany(userCredential.user.uid, details);
    } catch (error: unknown) {
      console.error('Error signing up:', error);
      throw error;
    }
  };

  // Sign in with email and password
  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: unknown) {
      console.error('Error signing in:', error);
      throw error;
    }
  };


  const sendPasswordReset = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: unknown) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  };

  // Sign out
  const signOut = async (): Promise<void> => {
    try {
      const uid = auth.currentUser?.uid;
      if (uid) {
        appendAuditLog(uid, uid, {
          action: 'auth.sign_out',
          entityType: 'auth',
          summary: 'Signed out',
        });
      }
      await firebaseSignOut(auth);
      setCompany(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  // Change password (re-authenticate then update)
  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    if (!user?.email) {
      throw new Error('Email account required to change password');
    }
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      appendAuditLog(user.uid, user.uid, {
        action: 'auth.password_changed',
        entityType: 'auth',
        summary: 'Password changed',
      });
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

  // Update company information
  const updateCompany = async (updates: Partial<Company>): Promise<void> => {
    if (!user || !company) {
      throw new Error('User or company not found');
    }

    // Firestore does not accept undefined; strip undefined values from payload
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    ) as Partial<Company>;

    const updatePayload = prepareDatesForFirestore({
      ...cleanUpdates,
      updatedAt: nowUtc(),
    });

    try {
      await updateDoc(doc(db, COMPANY_COLLECTION, user.uid), updatePayload);
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit id, updatedAt from payload
      const { id, createdAt, updatedAt, ...companyRest } = company;
      await setDoc(
        doc(db, COMPANY_COLLECTION, user.uid),
        prepareDatesForFirestore({
          ...companyRest,
          ...cleanUpdates,
          userId: user.uid,
          companyId: user.uid,
          createdAt: createdAt ?? nowUtc(),
          updatedAt: nowUtc(),
        }),
        { merge: true }
      );
    }

    setCompany({
      ...company,
      ...cleanUpdates,
      updatedAt: nowUtc(),
    } as Company);

    appendAuditLog(user.uid, user.uid, {
      action: 'company.updated',
      entityType: 'company',
      entityId: user.uid,
      summary: 'Company profile updated',
      changedFields: auditCompanyChangedKeys(cleanUpdates as Record<string, unknown>),
    });
  };

  const value: AuthContextType = {
    user,
    company,
    loading,
    signUp,
    signIn,
    sendPasswordReset,
    signOut,
    updateCompany,
    changePassword,
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await loadCompany(firebaseUser.uid);
      } else {
        setCompany(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
