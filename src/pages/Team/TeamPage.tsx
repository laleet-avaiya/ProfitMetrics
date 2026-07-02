import { useCallback, useEffect, useState } from 'react';
import { Mail, Shield, Trash2, UserPlus, Users } from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Select } from '../../components/Select/Select';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingView } from '../../components/AppLoader/AppLoader';
import { FormTabs } from '../../components/ui/FormTabs';
import { RolePermissionsEditor } from '../../components/Team/RolePermissionsEditor';
import {
  tableCellClass,
  tableClass,
  tableHeadCellClass,
  tableHeadRowClass,
  tableWrapClass,
} from '../../constants/ui';
import { useAuth } from '../../hooks/useAuth';
import { useModuleAccess, usePermissions } from '../../hooks/usePermissions';
import { useNotification } from '../../hooks/useNotification';
import { membershipService } from '../../services/membership';
import type { CompanyInvite, CompanyMember } from '../../types';
import { AppModule } from '../../constants/permissions';
import { COMPANY_ROLE_OPTIONS, CompanyRole, roleLabel } from '../../constants/roles';

type TeamTab = 'members' | 'permissions';

export function TeamPage() {
  const { user, company } = useAuth();
  const notification = useNotification();
  const { canCreate, canUpdate, canDelete } = useModuleAccess(AppModule.TEAM);

  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CompanyMember['role']>(CompanyRole.MANAGER);
  const [activeTab, setActiveTab] = useState<TeamTab>('members');
  const { isAdmin } = usePermissions();

  const loadTeam = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [memberList, inviteList] = await Promise.all([
        membershipService.listMembers(company.id),
        membershipService.listInvites(company.id),
      ]);
      setMembers(memberList.filter((member) => member.status === 'active'));
      setInvites(inviteList);
    } catch (error) {
      console.error('Failed to load team:', error);
      notification.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, [company, notification]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !user) return;

    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      notification.error('Enter an email address');
      return;
    }

    if (members.some((member) => member.email === email)) {
      notification.error('This user is already on your team');
      return;
    }

    if (invites.some((invite) => invite.email === email)) {
      notification.error('An invite is already pending for this email');
      return;
    }

    setSaving(true);
    try {
      await membershipService.inviteMember(company.id, email, inviteRole, user.uid);
      setInviteEmail('');
      setInviteRole(CompanyRole.MANAGER);
      notification.success(`Invite sent to ${email}`);
      await loadTeam();
    } catch (error) {
      console.error('Failed to invite member:', error);
      notification.error('Failed to send invite');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (member: CompanyMember, role: CompanyMember['role']) => {
    if (!company) return;
    if (member.userId === user?.uid) {
      notification.error('You cannot change your own role');
      return;
    }

    try {
      await membershipService.updateMemberRole(company.id, member.userId, role);
      notification.success('Role updated');
      await loadTeam();
    } catch (error) {
      console.error('Failed to update role:', error);
      notification.error('Failed to update role');
    }
  };

  const handleRemoveMember = async (member: CompanyMember) => {
    if (!company) return;
    if (member.userId === user?.uid) {
      notification.error('You cannot remove yourself');
      return;
    }

    try {
      await membershipService.removeMember(company.id, member.userId, user!.uid);
      notification.success('Team member removed');
      await loadTeam();
    } catch (error) {
      console.error('Failed to remove member:', error);
      notification.error('Failed to remove team member');
    }
  };

  const handleRevokeInvite = async (invite: CompanyInvite) => {
    if (!company || !user) return;
    try {
      await membershipService.revokeInvite(invite.id, user.uid, company.id);
      notification.success('Invite revoked');
      await loadTeam();
    } catch (error) {
      console.error('Failed to revoke invite:', error);
      notification.error('Failed to revoke invite');
    }
  };

  if (loading) {
    return (
      <Layout>
        <PageShell>
          <LoadingView message="Loading team…" size="xl" className="py-20" />
        </PageShell>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title="Team"
          description="Invite teammates, manage roles, and configure module permissions per role."
        />

        <FormTabs
          ariaLabel="Team sections"
          tabs={[
            { id: 'members' as const, label: 'Members', icon: Users },
            ...(isAdmin
              ? [{ id: 'permissions' as const, label: 'Role permissions', icon: Shield }]
              : []),
          ]}
          active={activeTab}
          onChange={(id) => setActiveTab(id as TeamTab)}
        />

        {activeTab === 'permissions' && isAdmin ? (
          <RolePermissionsEditor />
        ) : (
          <>
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium">
            <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Invite team member
          </div>
          <form onSubmit={handleInvite} className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
            <Input
              label="Email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@company.com"
              required
              disabled={!canCreate}
            />
            <Select
              label="Role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as CompanyMember['role'])}
              options={COMPANY_ROLE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              disabled={!canCreate}
            />
            <Button type="submit" variant="primary" loading={saving} disabled={!canCreate}>
              Send invite
            </Button>
          </form>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Invited users sign up or sign in with this email to join your company automatically.
          </p>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Active members ({members.length})
          </div>
          {members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No team members yet"
              description="Invite your first teammate to collaborate."
            />
          ) : (
            <div className={tableWrapClass}>
              <table className={tableClass}>
                <thead>
                  <tr className={tableHeadRowClass}>
                    <th className={tableHeadCellClass}>Member</th>
                    <th className={tableHeadCellClass}>Role</th>
                    <th className={tableHeadCellClass}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const isSelf = member.userId === user?.uid;
                    return (
                      <tr key={member.id}>
                        <td className={tableCellClass}>
                          <div className="font-medium text-gray-900 dark:text-white">{member.email}</div>
                          {isSelf ? (
                            <div className="text-xs text-gray-500 dark:text-gray-400">You</div>
                          ) : null}
                        </td>
                        <td className={tableCellClass}>
                          {isSelf ? (
                            <span className="inline-flex items-center gap-1 text-sm">
                              <Shield className="w-4 h-4" />
                              {roleLabel(member.role)}
                            </span>
                          ) : canUpdate ? (
                            <Select
                              label=""
                              aria-label={`Role for ${member.email}`}
                              value={member.role}
                              onChange={(e) =>
                                void handleRoleChange(member, e.target.value as CompanyMember['role'])
                              }
                              options={COMPANY_ROLE_OPTIONS.map((option) => ({
                                value: option.value,
                                label: option.label,
                              }))}
                            />
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sm">
                              <Shield className="w-4 h-4" />
                              {roleLabel(member.role)}
                            </span>
                          )}
                        </td>
                        <td className={tableCellClass}>
                          {!isSelf && canDelete ? (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => void handleRemoveMember(member)}
                              className="text-red-600 hover:text-red-700 dark:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {invites.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium">
              <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Pending invites ({invites.length})
            </div>
            <div className={tableWrapClass}>
              <table className={tableClass}>
                <thead>
                  <tr className={tableHeadRowClass}>
                    <th className={tableHeadCellClass}>Email</th>
                    <th className={tableHeadCellClass}>Role</th>
                    <th className={tableHeadCellClass}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr key={invite.id}>
                      <td className={tableCellClass}>{invite.email}</td>
                      <td className={tableCellClass}>{roleLabel(invite.role)}</td>
                      <td className={tableCellClass}>
                        {canDelete ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void handleRevokeInvite(invite)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
          </>
        )}
      </PageShell>
    </Layout>
  );
}
