/** Metadata for a file stored in Firebase Storage and linked to a business entity. */
export interface EntityAttachment {
  id: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: Date;
}
