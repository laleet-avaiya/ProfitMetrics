import { PageHeader, PageShell } from "../../components/PageShell/PageShell";
import { Link } from "react-router-dom";
import { Building2, FileText, Shield } from "lucide-react";
import { useCompanyMarketplaces } from "../../hooks/useCompanyMarketplaces";
import packageJson from "../../../package.json";

const APP_VERSION = packageJson.version;

export function About() {
  const { summary: marketplaceSummary } = useCompanyMarketplaces();

  return (
    <PageShell>
      <PageHeader
        title="About"
        description={`Profit Metrics — ecommerce profit & loss tracking across ${marketplaceSummary}.`}
      />

      <div className="space-y-5">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm">
          <h2 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-indigo-500" />
            Who we are
          </h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
            This app is built and supported by{" "}
            <strong className="text-gray-900 dark:text-white">
              Avaiya Software FZC
            </strong>
            .
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            You’re using version{" "}
            <strong className="text-gray-900 dark:text-white">
              {APP_VERSION}
            </strong>
            .
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm">
          <h2 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-indigo-500" />
            Legal
          </h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-3">
            Review our Terms & Conditions and Usage Policy, including the
            version your company accepted.
          </p>
          <Link
            to="/terms"
            className="inline-flex text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Terms & Usage Policy →
          </Link>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm">
          <h2 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-indigo-500" />
            Please use it fairly
          </h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-3">
            We’d like to keep this software secure and reliable for everyone. To
            do that, we ask that you:
          </p>
          <ul className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed space-y-2 list-disc list-inside marker:text-indigo-500">
            <li>Use the app only as allowed under your agreement</li>
            <li>Avoid copying or sharing it with others without permission</li>
            <li>
              Respect that Avaiya Software FZC may take action if these terms
              are not followed
            </li>
          </ul>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-4">
            Thank you for using the app responsibly. All rights reserved.
          </p>
        </section>
      </div>
    </PageShell>
  );
}
