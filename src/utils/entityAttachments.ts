import type { EntityAttachmentCollection } from '../constants/attachments';
import type { EntityAttachment } from '../models/attachment';
import { uploadEntityAttachments } from '../services/entityAttachments';

/** Upload staged files after a new entity is created. */
export async function finalizePendingAttachments(
  orgId: string,
  companyId: string,
  collection: EntityAttachmentCollection,
  entityId: string,
  pendingFiles: File[],
  userId: string
): Promise<EntityAttachment[]> {
  if (pendingFiles.length === 0) return [];
  return uploadEntityAttachments(orgId, companyId, collection, entityId, pendingFiles, userId);
}
