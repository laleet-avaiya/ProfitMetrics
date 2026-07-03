import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { Button } from '../Button/Button';
import { Card } from '../ui/Card';
import {
  actionLabel,
  DEFAULT_ROLE_PERMISSIONS,
  MODULE_DEFINITIONS,
  PERMISSION_ACTIONS,
  permissionKey,
  type AppModule,
  type ModulePermissionMap,
  type PermissionAction,
} from '../../constants/permissions';
import { CompanyRole, roleLabel } from '../../constants/roles';
import { rolePermissionsService } from '../../services/rolePermissions';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';

const EDITABLE_ROLES = [CompanyRole.MANAGER, CompanyRole.VIEWER, CompanyRole.ACCOUNTANT] as const;

export function RolePermissionsEditor() {
  const { company, refreshRolePermissions } = useAuth();
  const notification = useNotification();
  const [activeRole, setActiveRole] = useState<(typeof EDITABLE_ROLES)[number]>(CompanyRole.MANAGER);
  const [permissions, setPermissions] = useState<ModulePermissionMap>(
    DEFAULT_ROLE_PERMISSIONS[CompanyRole.MANAGER]
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company) return;
    setLoading(true);
    void rolePermissionsService.get(company.id, activeRole).then((definition) => {
      setPermissions(definition?.permissions ?? DEFAULT_ROLE_PERMISSIONS[activeRole]);
      setLoading(false);
    });
  }, [company, activeRole]);

  const toggle = (module: AppModule, action: PermissionAction) => {
    const key = permissionKey(module, action);
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!company) return;
    setSaving(true);
    try {
      await rolePermissionsService.update(company.id, activeRole, permissions);
      await refreshRolePermissions();
      notification.success(`${roleLabel(activeRole)} permissions saved`);
    } catch (error) {
      console.error('Failed to save role permissions:', error);
      notification.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPermissions(DEFAULT_ROLE_PERMISSIONS[activeRole]);
  };

  if (loading) {
    return <Card className="p-6 text-sm text-gray-500 dark:text-gray-400">Loading permissions…</Card>;
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium">
        <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        Role permissions
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Configure what each role can do per module. Admin always has full access.
      </p>

      <div className="flex flex-wrap gap-2">
        {EDITABLE_ROLES.map((role) => (
          <Button
            key={role}
            type="button"
            variant={activeRole === role ? 'primary' : 'outline'}
            onClick={() => setActiveRole(role)}
          >
            {roleLabel(role)}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 pr-4 font-medium text-gray-700 dark:text-gray-300">Module</th>
              {PERMISSION_ACTIONS.map((action) => (
                <th key={action} className="text-center px-3 py-2 font-medium text-gray-700 dark:text-gray-300">
                  {actionLabel(action)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULE_DEFINITIONS.map((module) => (
              <tr key={module.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-3 pr-4">
                  <div className="font-medium text-gray-900 dark:text-white">{module.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{module.description}</div>
                </td>
                {PERMISSION_ACTIONS.map((action) => (
                  <td key={action} className="text-center px-3 py-3">
                    <input
                      type="checkbox"
                      checked={permissions[permissionKey(module.id, action)] === true}
                      onChange={() => toggle(module.id, action)}
                      aria-label={`${module.label} ${actionLabel(action)}`}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="primary" loading={saving} onClick={() => void handleSave()}>
          Save {roleLabel(activeRole)} permissions
        </Button>
        <Button type="button" variant="outline" onClick={handleReset}>
          Reset to defaults
        </Button>
      </div>
    </Card>
  );
}
