export const OrgRole = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole];

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  companyQuota: number;
  aiMessageQuota?: number;
  aiMessagesUsed?: number;
  subscriptionStart?: Date;
  subscriptionEnd?: Date;
  termsVersion?: string;
  termsAcceptedAt?: Date;
  usagePolicyAcceptedAt?: Date;
  legalAcceptedByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}
