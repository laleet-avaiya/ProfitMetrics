import { useRef, useState } from 'react';
import { FileText, ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react';
import { Button } from '../Button/Button';
import {
  ATTACHMENT_ACCEPT,
  formatAttachmentSize,
  validateAttachmentFile,
  type EntityAttachmentCollection,
} from '../../constants/attachments';
import type { EntityAttachment } from '../../models/attachment';
import {
  deleteEntityAttachment,
  getEntityAttachmentUrl,
  uploadEntityAttachment,
} from '../../services/entityAttachments';
import { formatDateLocal } from '../../utils/date';

interface PendingFile {
  id: string;
  file: File;
}

function attachmentIcon(contentType: string) {
  if (contentType.startsWith('image/')) {
    return ImageIcon;
  }
  return FileText;
}

export interface EntityAttachmentsPanelProps {
  orgId: string;
  companyId: string;
  collection: EntityAttachmentCollection;
  entityId: string | null;
  userId: string;
  attachments: EntityAttachment[];
  onAttachmentsChange: (attachments: EntityAttachment[]) => void;
  pendingFiles?: PendingFile[];
  onPendingFilesChange?: (files: PendingFile[]) => void;
  canEdit?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export function EntityAttachmentsPanel({
  orgId,
  companyId,
  collection,
  entityId,
  userId,
  attachments,
  onAttachmentsChange,
  pendingFiles = [],
  onPendingFilesChange,
  canEdit = true,
  disabled = false,
  compact = false,
}: EntityAttachmentsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const showUpload = canEdit && !disabled;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0) return;

    setError(null);

    for (const file of selected) {
      const validationError = validateAttachmentFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (!entityId) {
      if (!onPendingFilesChange) return;
      onPendingFilesChange([
        ...pendingFiles,
        ...selected.map((file) => ({ id: crypto.randomUUID(), file })),
      ]);
      return;
    }

    setUploading(true);
    try {
      const uploaded: EntityAttachment[] = [];
      for (const file of selected) {
        uploaded.push(
          await uploadEntityAttachment(orgId, companyId, collection, entityId, file, userId)
        );
      }
      onAttachmentsChange([...attachments, ...uploaded]);
    } catch (err) {
      console.error('Failed to upload attachment:', err);
      setError('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = async (attachment: EntityAttachment) => {
    setError(null);
    try {
      await deleteEntityAttachment(attachment.storagePath);
      onAttachmentsChange(attachments.filter((item) => item.id !== attachment.id));
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      setError('Failed to remove file. Please try again.');
    }
  };

  const handleRemovePending = (id: string) => {
    onPendingFilesChange?.(pendingFiles.filter((item) => item.id !== id));
  };

  const handleOpen = async (attachment: EntityAttachment) => {
    setOpeningId(attachment.id);
    try {
      const url = await getEntityAttachmentUrl(attachment.storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Failed to open attachment:', err);
      setError('Failed to open file.');
    } finally {
      setOpeningId(null);
    }
  };

  const totalCount = attachments.length + pendingFiles.length;
  const empty = totalCount === 0;

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {!compact ? (
        <div>
          <p className="text-xs font-semibold text-gray-900 dark:text-white">Supporting documents</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            Upload receipts, invoices, product images, or PDFs (max 10 MB each).
          </p>
        </div>
      ) : null}

      {showUpload ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading || disabled}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
            disabled={disabled}
          >
            <Upload className="w-4 h-4" />
            Upload document
          </Button>
        </>
      ) : null}

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {empty ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {showUpload ? 'No documents attached yet.' : 'No supporting documents.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700/80 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          {attachments.map((attachment) => {
            const Icon = attachmentIcon(attachment.contentType);
            return (
              <li
                key={attachment.id}
                className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-800"
              >
                <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => handleOpen(attachment)}
                    disabled={openingId === attachment.id}
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate block text-left max-w-full"
                  >
                    {attachment.fileName}
                  </button>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {formatAttachmentSize(attachment.sizeBytes)}
                    {attachment.uploadedAt ? ` · ${formatDateLocal(attachment.uploadedAt)}` : ''}
                  </p>
                </div>
                {showUpload ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAttachment(attachment)}
                    aria-label={`Remove ${attachment.fileName}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                ) : (
                  <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
                )}
              </li>
            );
          })}
          {pendingFiles.map(({ id, file }) => {
            const Icon = attachmentIcon(file.type);
            return (
              <li
                key={id}
                className="flex items-center gap-3 px-3 py-2.5 bg-amber-50/50 dark:bg-amber-950/20"
              >
                <Icon className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    {formatAttachmentSize(file.size)} · Will upload on save
                  </p>
                </div>
                {showUpload ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemovePending(id)}
                    aria-label={`Remove ${file.name}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export type { PendingFile };
