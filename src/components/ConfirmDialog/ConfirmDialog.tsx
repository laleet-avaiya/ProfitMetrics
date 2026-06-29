import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import { FormActions } from '../FormActions/FormActions';
import type { ConfirmOptions } from '../../contexts/NotificationContext.types';

interface ConfirmDialogProps {
  open: boolean;
  options: ConfirmOptions | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, options, onClose, onConfirm }: ConfirmDialogProps) {
  if (!options) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    options.onCancel?.();
    onClose();
  };

  return (
    <Modal
      isOpen={open}
      onClose={handleCancel}
      title={options.title}
      size="sm"
      showCloseButton={true}
    >
      <div className="space-y-4">
        <p className="text-gray-600 dark:text-gray-400">{options.message}</p>
        <FormActions layout="end" className="pt-0">
          <Button variant="outline" onClick={handleCancel}>
            {options.cancelLabel ?? 'Cancel'}
          </Button>
          <Button variant={options.variant ?? 'danger'} onClick={handleConfirm}>
            {options.confirmLabel ?? 'Confirm'}
          </Button>
        </FormActions>
      </div>
    </Modal>
  );
}
