import { Button } from '../Button/Button';
import { FormStickyActions } from '../FormStickyActions/FormStickyActions';
import { LoadingView } from '../AppLoader/AppLoader';
import { Sparkles } from 'lucide-react';

export function FormPageLoading({ message = 'Loading…' }: { message?: string }) {
  return <LoadingView message={message} size="lg" className="py-16" />;
}

interface FormPageHeaderActionsProps {
  formId: string;
  onCancel: () => void;
  saving: boolean;
  isEditing: boolean;
  createLabel: string;
  editLabel?: string;
  showSparkle?: boolean;
}

export function FormPageHeaderActions({
  formId,
  onCancel,
  saving,
  isEditing,
  createLabel,
  editLabel = 'Save changes',
  showSparkle = true,
}: FormPageHeaderActionsProps) {
  return (
    <div className="hidden lg:flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" form={formId} variant="primary" loading={saving}>
        {!isEditing && !saving && showSparkle ? (
          <>
            <Sparkles className="w-4 h-4" />
            {createLabel}
          </>
        ) : isEditing ? (
          editLabel
        ) : (
          createLabel
        )}
      </Button>
    </div>
  );
}

interface FormPageMobileActionsProps {
  onCancel: () => void;
  saving: boolean;
  isEditing: boolean;
  createLabel: string;
  editLabel?: string;
}

export function FormPageMobileActions({
  onCancel,
  saving,
  isEditing,
  createLabel,
  editLabel = 'Save changes',
}: FormPageMobileActionsProps) {
  return (
    <FormStickyActions className="lg:hidden">
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" variant="primary" loading={saving}>
        {isEditing ? editLabel : createLabel}
      </Button>
    </FormStickyActions>
  );
}

export function FormPageNotFound({
  title,
  description,
  backLabel,
  onBack,
}: {
  title: string;
  description: string;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>
      <Button type="button" variant="outline" onClick={onBack}>
        {backLabel}
      </Button>
    </>
  );
}
