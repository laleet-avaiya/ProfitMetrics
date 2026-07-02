import { Paperclip } from 'lucide-react';
import { DetailSection } from '../DetailPage/DetailSection';
import { EntityAttachmentsPanel } from '../EntityAttachments';
import type { EntityAttachmentCollection } from '../../constants/attachments';
import type { EntityAttachment } from '../../models/attachment';

interface EntityAttachmentsDetailSectionProps {
  orgId: string;
  companyId: string;
  collection: EntityAttachmentCollection;
  entityId: string;
  userId: string;
  attachments: EntityAttachment[];
  onAttachmentsChange: (attachments: EntityAttachment[]) => void | Promise<void>;
  canEdit?: boolean;
}

export function EntityAttachmentsDetailSection({
  orgId,
  companyId,
  collection,
  entityId,
  userId,
  attachments,
  onAttachmentsChange,
  canEdit = false,
}: EntityAttachmentsDetailSectionProps) {
  const hasAttachments = attachments.length > 0;

  if (!canEdit && !hasAttachments) {
    return null;
  }

  return (
    <DetailSection
      icon={Paperclip}
      iconTone="indigo"
      title="Supporting documents"
      description="Receipts, invoices, quotes, and other files linked to this record."
    >
      <EntityAttachmentsPanel
        orgId={orgId}
        companyId={companyId}
        collection={collection}
        entityId={entityId}
        userId={userId}
        attachments={attachments}
        onAttachmentsChange={(next) => {
          void onAttachmentsChange(next);
        }}
        canEdit={canEdit}
        compact
      />
    </DetailSection>
  );
}
