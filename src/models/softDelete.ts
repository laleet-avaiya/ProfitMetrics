/** Shared soft-delete fields for documents that are never physically removed. */
export interface SoftDeletable {
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}

export function isNotDeleted<T extends SoftDeletable>(item: T): boolean {
  return !item.deleted;
}
