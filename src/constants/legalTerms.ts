/** Bump when T&C or usage policy changes — companies must re-accept. */
export const CURRENT_LEGAL_VERSION = '1.1';

export const LEGAL_LAST_UPDATED = '29 June 2026';

export const TERMS_SECTIONS = [
  {
    title: '1. Agreement',
    body: 'By using Profit Metrics (“the Service”), operated by Avaiya Software FZC (“we”, “us”), you agree to these Terms & Conditions and our Usage Policy. If you do not agree, do not use the Service.',
  },
  {
    title: '2. Service description',
    body: 'The Service helps businesses track ecommerce sales, expenses, profit, and tax-related figures across marketplaces. Calculations and reports are provided for your convenience and do not constitute accounting, tax, or legal advice.',
  },
  {
    title: '3. Your account & data',
    body: 'You are responsible for keeping login credentials secure and for the accuracy of data you enter. You retain ownership of your business data. We process it to provide the Service and as described in our privacy practices.',
  },
  {
    title: '4. Subscription & billing',
    body: 'Access may be subject to an active subscription. Renewal, plan changes, and billing are handled through your company administrator or Avaiya Software support. We may suspend access when a subscription expires.',
  },
  {
    title: '5. Acceptable use',
    body: 'You must not misuse the Service, attempt unauthorized access, reverse engineer the software, resell access without permission, or use it in violation of applicable law. You must not share access with another company, allow third parties to use your account, or reproduce, copy, or replicate the Service or its features for use outside your licensed account.',
  },
  {
    title: '6. Intellectual property & unauthorized use',
    body: 'Profit Metrics, including its software, design, workflows, reports, and features, is owned by Avaiya Software FZC and protected by applicable intellectual property laws. If you share the platform with another company, or if any party copies or replicates our features or product without authorization, we may pursue legal action to recover losses, damages, and any other remedies available under law.',
  },
  {
    title: '7. Limitation of liability',
    body: 'The Service is provided “as is”. To the fullest extent permitted by law, we are not liable for indirect or consequential losses arising from use of the Service or reliance on reports generated within it.',
  },
  {
    title: '8. Changes',
    body: 'We may update these terms. When we do, we will publish a new version and may require renewed acceptance before continued use.',
  },
  {
    title: '9. Contact',
    body: 'Questions about these terms: hello@avaiyasoftware.com',
  },
] as const;

export const USAGE_POLICY_SECTIONS = [
  {
    title: 'Fair & permitted use',
    body: 'Use the Service only for your own business operations under your subscription or trial. Do not share your account or platform access with other companies, unauthorized users, or third parties. Do not copy, clone, or redistribute the software or its features.',
  },
  {
    title: 'Data responsibility',
    body: 'You are responsible for reviewing figures before filing taxes or making business decisions. Export and backup important records regularly.',
  },
  {
    title: 'Security',
    body: 'Notify us promptly if you suspect unauthorized access. We may suspend accounts that pose a security risk or violate this policy.',
  },
  {
    title: 'Intellectual property',
    body: 'Avaiya Software FZC retains all rights in the Service, branding, and software. Your business data remains yours. Copying or replicating platform features for another product or company without permission is prohibited and may result in legal action for losses and damages.',
  },
] as const;
