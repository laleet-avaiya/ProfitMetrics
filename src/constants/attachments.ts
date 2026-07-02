export const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

export const ATTACHMENT_ACCEPT = ATTACHMENT_ALLOWED_TYPES.join(',');

export type EntityAttachmentCollection = 'products' | 'sales' | 'purchases' | 'expenses';

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateAttachmentFile(file: File): string | null {
  if (!ATTACHMENT_ALLOWED_TYPES.includes(file.type as (typeof ATTACHMENT_ALLOWED_TYPES)[number])) {
    return 'Invalid file type. Use JPEG, PNG, GIF, WebP, HEIC, or PDF.';
  }
  if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
    return 'File is too large. Maximum size is 10 MB.';
  }
  return null;
}
