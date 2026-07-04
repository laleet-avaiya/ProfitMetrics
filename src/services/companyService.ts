import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import type { Company } from '../models/company';
import type { CreateCompanyDetails } from '../contexts/AuthContext.types';
import { membershipService } from './membership';
import { rolePermissionsService } from './rolePermissions';
import { orgService } from './org';
import { appendAuditLog } from './auditLog';
import {
  BusinessCountry,
  countryDefaultsForCompany,
  getCountryProfile,
  isBusinessCountry,
} from '../constants/countries';
import { DEFAULT_MARKETPLACES } from '../constants/platforms';
import {
  convertTimestamps,
  fromFirestoreTimestamp,
  nowUtc,
  prepareDatesForFirestore,
} from '../utils/firestoreDates';

const COLLECTION = 'companies';

function mapCompany(id: string, data: Record<string, unknown>): Company {
  const converted = convertTimestamps<Record<string, unknown>>(data);
  const country = isBusinessCountry(String(converted.country ?? ''))
    ? (converted.country as BusinessCountry)
    : BusinessCountry.UAE;
  const profile = getCountryProfile(country);

  return {
    id,
    orgId: String(converted.orgId ?? ''),
    createdBy: String(converted.createdBy ?? ''),
    name: String(converted.name ?? ''),
    country,
    currency: (converted.currency as string) ?? profile.currency,
    timezone: (converted.timezone as string) ?? profile.timezone,
    defaultTaxType: (converted.defaultTaxType as Company['defaultTaxType']) ?? profile.defaultTaxType,
    defaultTaxMode: (converted.defaultTaxMode as Company['defaultTaxMode']) ?? profile.defaultTaxMode,
    defaultTaxPercentage: Number(converted.defaultTaxPercentage ?? profile.defaultTaxPercentage),
    marketplaces: Array.isArray(converted.marketplaces)
      ? (converted.marketplaces as string[])
      : [...DEFAULT_MARKETPLACES],
    trn: converted.trn as string | undefined,
    address: converted.address as string | undefined,
    phone: converted.phone as string | undefined,
    phone2: converted.phone2 as string | undefined,
    email: converted.email as string | undefined,
    logo: converted.logo as string | undefined,
    bankName: converted.bankName as string | undefined,
    bankAccountName: converted.bankAccountName as string | undefined,
    bankIban: converted.bankIban as string | undefined,
    bankAccountNumber: converted.bankAccountNumber as string | undefined,
    bankSwift: converted.bankSwift as string | undefined,
    invoiceFooterNotes: converted.invoiceFooterNotes as string | undefined,
    invoiceTerms: converted.invoiceTerms as string | undefined,
    updatedBy: converted.updatedBy ? String(converted.updatedBy) : undefined,
    createdAt: fromFirestoreTimestamp(converted.createdAt) ?? nowUtc(),
    updatedAt: fromFirestoreTimestamp(converted.updatedAt) ?? nowUtc(),
  };
}

export const companyService = {
  async get(companyId: string): Promise<Company | null> {
    const snap = await getDoc(doc(db, COLLECTION, companyId));
    if (!snap.exists()) return null;
    return mapCompany(snap.id, snap.data() as Record<string, unknown>);
  },

  async listForOrg(orgId: string): Promise<Company[]> {
    const q = query(collection(db, COLLECTION), where('orgId', '==', orgId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((companyDoc) =>
      mapCompany(companyDoc.id, companyDoc.data() as Record<string, unknown>)
    );
  },

  async listForUser(userId: string): Promise<Company[]> {
    const memberships = await membershipService.listMembershipsForUser(userId);
    const companies = await Promise.all(
      memberships.map(async (m) => {
        try {
          return await this.get(m.companyId);
        } catch (err) {
          console.error('Failed to load company for membership:', m.companyId, err);
          return null;
        }
      })
    );
    return companies.filter((c): c is Company => c != null);
  },

  async create(
    orgId: string,
    userId: string,
    email: string,
    details: CreateCompanyDetails
  ): Promise<Company> {
    const org = await orgService.get(orgId);
    if (!org) throw new Error('Organization not found');

    const count = await orgService.countCompanies(orgId);
    if (count >= org.companyQuota) {
      throw new Error(`Company limit reached (${org.companyQuota}). Upgrade your plan to add more.`);
    }

    const companyId = crypto.randomUUID();
    const now = nowUtc();
    const locale = countryDefaultsForCompany(details.country);
    const profile = getCountryProfile(details.country);

    const company: Company = {
      id: companyId,
      orgId,
      createdBy: userId,
      name: details.companyName.trim(),
      ...locale,
      marketplaces: [...DEFAULT_MARKETPLACES],
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(
      doc(db, COLLECTION, companyId),
      prepareDatesForFirestore({ ...company, updatedBy: userId } as unknown as Record<string, unknown>)
    );
    await membershipService.createAdminMember(companyId, userId, email);
    await rolePermissionsService.seedDefaults(companyId);

    appendAuditLog(companyId, userId, {
      action: 'company.created',
      entityType: 'company',
      entityId: companyId,
      summary: `Company ${details.companyName} created (${profile.label})`,
    });

    return company;
  },
};
