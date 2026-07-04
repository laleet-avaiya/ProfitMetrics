import type { ReactNode } from "react";
import { PageHeader, PageShell } from "../PageShell/PageShell";

interface SectionPageProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export function SectionPage({
  title,
  description,
  children,
}: SectionPageProps) {
  return (
    <PageShell>
      <PageHeader title={title} description={description} />
      {children}
    </PageShell>
  );
}
