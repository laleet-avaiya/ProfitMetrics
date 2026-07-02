export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  activeOrgId?: string;
  activeCompanyId?: string;
  createdAt: Date;
  updatedAt: Date;
}
