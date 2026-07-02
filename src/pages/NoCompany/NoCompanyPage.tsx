import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Button } from '../../components/Button/Button';
import { useAuth } from '../../hooks/useAuth';

export function NoCompanyPage() {
  const { signOut } = useAuth();

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title="No company access"
          description="Your account is not linked to a company yet. Ask your admin to invite you, or create a new company."
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <Link to="/create-company">
            <Button variant="primary">Create a company</Button>
          </Link>
          <Button type="button" variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </PageShell>
    </Layout>
  );
}
