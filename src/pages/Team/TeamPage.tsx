import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { PageHeader, PageShell } from "../../components/PageShell/PageShell";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { Select } from "../../components/Select/Select";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingView } from "../../components/AppLoader/AppLoader";
import { FormTabs } from "../../components/ui/FormTabs";
import { RolePermissionsEditor } from "../../components/Team/RolePermissionsEditor";
import {
  DataTable,
  embeddedTableWrapClass,
  type DataTableColumn,
} from "../../components/ui/DataTable";
import { useAuth } from "../../hooks/useAuth";
import { useModuleAccess, usePermissions } from "../../hooks/usePermissions";
import { useNotification } from "../../hooks/useNotification";
import { membershipService } from "../../services/membership";
import { userDirectoryService } from "../../services/userDirectory";
import type { CompanyInvite, CompanyMember } from "../../types";
import { AppModule } from "../../constants/permissions";
import {
  COMPANY_ROLE_OPTIONS,
  CompanyRole,
  roleLabel,
} from "../../constants/roles";
import { BRAND_NAME } from "../../constants/brand";

function signupUrl(): string {
  return `${window.location.origin}/signup`;
}

type TeamTab = "members" | "permissions";

export function TeamPage() {
  const { user, company } = useAuth();
  const notification = useNotification();
  const { canCreate, canUpdate, canDelete } = useModuleAccess(AppModule.TEAM);

  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CompanyMember["role"]>(
    CompanyRole.MANAGER,
  );
  const [inviteHasAccount, setInviteHasAccount] = useState<
    Record<string, boolean>
  >({});
  const [activeTab, setActiveTab] = useState<TeamTab>("members");
  const { isAdmin } = usePermissions();

  const loadTeam = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [memberList, inviteList] = await Promise.all([
        membershipService.listMembers(company.id),
        membershipService.listInvites(company.id),
      ]);
      setMembers(memberList.filter((member) => member.status === "active"));
      setInvites(inviteList);

      const accountFlags = await Promise.all(
        inviteList.map(async (invite) => {
          try {
            const hasAccount = await userDirectoryService.hasAccount(
              invite.email,
            );
            return [invite.id, hasAccount] as const;
          } catch {
            return [invite.id, false] as const;
          }
        }),
      );
      setInviteHasAccount(Object.fromEntries(accountFlags));
    } catch (error) {
      console.error("Failed to load team:", error);
      notification.error("Failed to load team members");
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
      notification.error("Enter an email address");
      return;
    }

    if (members.some((member) => member.email === email)) {
      notification.error("This user is already on your team");
      return;
    }

    if (invites.some((invite) => invite.email === email)) {
      notification.error("An invite is already pending for this email");
      return;
    }

    setSaving(true);
    try {
      await membershipService.inviteMember(
        company.id,
        email,
        inviteRole,
        user.uid,
      );
      const hasAccount = await userDirectoryService.hasAccount(email);
      setInviteEmail("");
      setInviteRole(CompanyRole.MANAGER);
      notification.success(`Invite sent to ${email}`);
      if (!hasAccount) {
        notification.info(
          `This person does not have a ${BRAND_NAME} account yet. Ask them to sign up at ${signupUrl()} using exactly ${email} — they will join your company automatically after signing up.`,
        );
      }
      await loadTeam();
    } catch (error) {
      console.error("Failed to invite member:", error);
      notification.error("Failed to send invite");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (
    member: CompanyMember,
    role: CompanyMember["role"],
  ) => {
    if (!company) return;
    if (member.userId === user?.uid) {
      notification.error("You cannot change your own role");
      return;
    }

    try {
      await membershipService.updateMemberRole(
        company.id,
        member.userId,
        role,
        user!.uid,
      );
      notification.success("Role updated");
      await loadTeam();
    } catch (error) {
      console.error("Failed to update role:", error);
      notification.error("Failed to update role");
    }
  };

  const handleRemoveMember = async (member: CompanyMember) => {
    if (!company) return;
    if (member.userId === user?.uid) {
      notification.error("You cannot remove yourself");
      return;
    }

    try {
      await membershipService.removeMember(
        company.id,
        member.userId,
        user!.uid,
      );
      notification.success("Team member removed");
      await loadTeam();
    } catch (error) {
      console.error("Failed to remove member:", error);
      notification.error("Failed to remove team member");
    }
  };

  const handleRevokeInvite = async (invite: CompanyInvite) => {
    if (!company || !user) return;
    try {
      await membershipService.revokeInvite(invite.id, user.uid, company.id);
      notification.success("Invite revoked");
      await loadTeam();
    } catch (error) {
      console.error("Failed to revoke invite:", error);
      notification.error("Failed to revoke invite");
    }
  };

  const memberColumns = useMemo<DataTableColumn<CompanyMember>[]>(
    () => [
      {
        key: "email",
        header: "Member",
        sortable: true,
        sortValue: (member) => member.email,
        render: (member) => {
          const isSelf = member.userId === user?.uid;
          return (
            <>
              <div className="font-medium text-gray-900 dark:text-white">
                {member.email}
              </div>
              {isSelf ? (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  You
                </div>
              ) : null}
            </>
          );
        },
      },
      {
        key: "role",
        header: "Role",
        sortable: true,
        sortValue: (member) => member.role,
        render: (member) => {
          const isSelf = member.userId === user?.uid;
          if (isSelf) {
            return (
              <span className="inline-flex items-center gap-1 text-sm">
                <Shield className="w-4 h-4" />
                {roleLabel(member.role)}
              </span>
            );
          }
          if (canUpdate) {
            return (
              <Select
                label=""
                aria-label={`Role for ${member.email}`}
                value={member.role}
                onChange={(e) =>
                  void handleRoleChange(
                    member,
                    e.target.value as CompanyMember["role"],
                  )
                }
                options={COMPANY_ROLE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            );
          }
          return (
            <span className="inline-flex items-center gap-1 text-sm">
              <Shield className="w-4 h-4" />
              {roleLabel(member.role)}
            </span>
          );
        },
      },
      {
        key: "actions",
        header: "Actions",
        render: (member) => {
          const isSelf = member.userId === user?.uid;
          if (isSelf || !canDelete) return null;
          return (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleRemoveMember(member)}
              className="text-red-600 hover:text-red-700 dark:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </Button>
          );
        },
      },
    ],
    [user?.uid, canUpdate, canDelete],
  );

  const inviteColumns = useMemo<DataTableColumn<CompanyInvite>[]>(
    () => [
      {
        key: "email",
        header: "Email",
        sortable: true,
        sortValue: (invite) => invite.email,
        render: (invite) => invite.email,
      },
      {
        key: "role",
        header: "Role",
        sortable: true,
        sortValue: (invite) => invite.role,
        render: (invite) => roleLabel(invite.role),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        sortValue: (invite) => {
          const hasAccount = inviteHasAccount[invite.id];
          if (hasAccount === undefined) return "";
          return hasAccount ? "has account" : "needs signup";
        },
        render: (invite) => {
          const hasAccount = inviteHasAccount[invite.id];
          return (
            <span
              className={
                hasAccount === true
                  ? "text-gray-600 dark:text-gray-400"
                  : hasAccount === false
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-gray-500 dark:text-gray-500"
              }
            >
              {hasAccount === undefined
                ? "—"
                : hasAccount
                  ? "Has account — can sign in"
                  : "Needs signup"}
            </span>
          );
        },
      },
      {
        key: "actions",
        header: "Actions",
        render: (invite) =>
          canDelete ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleRevokeInvite(invite)}
              className="text-red-600 hover:text-red-700 dark:text-red-400"
            >
              Revoke
            </Button>
          ) : null,
      },
    ],
    [inviteHasAccount, canDelete],
  );

  if (loading) {
    return (
      <PageShell>
        <LoadingView message="Loading team…" size="xl" className="py-20" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Team"
        description="Invite teammates, manage roles, and configure module permissions per role."
      />

      <FormTabs
        ariaLabel="Team sections"
        tabs={[
          { id: "members" as const, label: "Members", icon: Users },
          ...(isAdmin
            ? [
                {
                  id: "permissions" as const,
                  label: "Role permissions",
                  icon: Shield,
                },
              ]
            : []),
        ]}
        active={activeTab}
        onChange={(id) => setActiveTab(id as TeamTab)}
      />

      {activeTab === "permissions" && isAdmin ? (
        <RolePermissionsEditor />
      ) : (
        <>
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium">
              <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Invite team member
            </div>
            <form
              onSubmit={handleInvite}
              className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end"
            >
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
                onChange={(e) =>
                  setInviteRole(e.target.value as CompanyMember["role"])
                }
                options={COMPANY_ROLE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                disabled={!canCreate}
              />
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                disabled={!canCreate}
              >
                Send invite
              </Button>
            </form>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Invites are tied to the email address. If someone is new to{" "}
              {BRAND_NAME}, ask them to{" "}
              <a
                href="/signup"
                className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline"
              >
                sign up
              </a>{" "}
              with that same email — existing users can sign in instead.
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
              <DataTable
                columns={memberColumns}
                rows={members}
                rowKey={(member) => member.id}
                defaultSort={{ key: "email", direction: "asc" }}
                wrapClassName={embeddedTableWrapClass}
              />
            )}
          </div>

          {invites.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium">
                <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Pending invites ({invites.length})
              </div>
              <DataTable
                columns={inviteColumns}
                rows={invites}
                rowKey={(invite) => invite.id}
                defaultSort={{ key: "email", direction: "asc" }}
                wrapClassName={embeddedTableWrapClass}
              />
            </div>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
