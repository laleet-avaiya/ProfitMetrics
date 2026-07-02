/** Who created and last updated a document. */
export interface Auditable {
  createdBy?: string;
  updatedBy?: string;
}

/** Soft-delete + audit trail fields shared by most persisted documents. */
export interface TrackedDocument extends Auditable {
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}

/** @deprecated Use TrackedDocument */
export type SoftDeletable = TrackedDocument;

export function isNotDeleted<T extends { deleted?: boolean }>(item: T): boolean {
  return !item.deleted;
}
