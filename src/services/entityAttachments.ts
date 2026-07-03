import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  resolveAttachmentContentType,
  type EntityAttachmentCollection,
} from '../constants/attachments';
import type { EntityAttachment } from '../models/attachment';
import { nowUtc } from '../utils/firestoreDates';
import { storage } from './firebase';

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export function entityAttachmentStoragePath(
  orgId: string,
  companyId: string,
  collection: EntityAttachmentCollection,
  entityId: string,
  attachmentId: string,
  fileName: string
): string {
  const safeName = sanitizeFileName(fileName);
  return `${orgId}/companies/${companyId}/${collection}/${entityId}/${attachmentId}_${safeName}`;
}

export async function uploadEntityAttachment(
  orgId: string,
  companyId: string,
  collection: EntityAttachmentCollection,
  entityId: string,
  file: File,
  userId: string
): Promise<EntityAttachment> {
  const id = crypto.randomUUID();
  const storagePath = entityAttachmentStoragePath(
    orgId,
    companyId,
    collection,
    entityId,
    id,
    file.name
  );
  const storageRef = ref(storage, storagePath);
  const contentType = resolveAttachmentContentType(file);

  await uploadBytes(storageRef, file, { contentType });

  return {
    id,
    storagePath,
    fileName: file.name,
    contentType,
    sizeBytes: file.size,
    uploadedBy: userId,
    uploadedAt: nowUtc(),
  };
}

export async function uploadEntityAttachments(
  orgId: string,
  companyId: string,
  collection: EntityAttachmentCollection,
  entityId: string,
  files: File[],
  userId: string
): Promise<EntityAttachment[]> {
  const uploaded: EntityAttachment[] = [];
  for (const file of files) {
    uploaded.push(
      await uploadEntityAttachment(orgId, companyId, collection, entityId, file, userId)
    );
  }
  return uploaded;
}

export async function deleteEntityAttachment(storagePath: string): Promise<void> {
  await deleteObject(ref(storage, storagePath));
}

export async function getEntityAttachmentUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath));
}
