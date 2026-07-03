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
  const contentType = resolveAttachmentContentType(file);
  if (!ATTACHMENT_ALLOWED_TYPES.includes(contentType as (typeof ATTACHMENT_ALLOWED_TYPES)[number])) {
    return 'Invalid file type. Use JPEG, PNG, GIF, WebP, HEIC, or PDF.';
  }
  if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
    return 'File is too large. Maximum size is 10 MB.';
  }
  return null;
}

const EXTENSION_CONTENT_TYPES: Record<string, (typeof ATTACHMENT_ALLOWED_TYPES)[number]> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
};

/** Resolve a storage-safe MIME type (some browsers leave file.type empty). */
export function resolveAttachmentContentType(file: File): string {
  if (file.type && ATTACHMENT_ALLOWED_TYPES.includes(file.type as (typeof ATTACHMENT_ALLOWED_TYPES)[number])) {
    return file.type;
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_CONTENT_TYPES[extension] ?? file.type;
}
