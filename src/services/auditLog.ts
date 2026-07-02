import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const COLLECTION = 'auditLogs';

export type AuditAction =
  | 'invoice.created'
  | 'invoice.updated'
  | 'invoice.deleted'
  | 'quotation.created'
  | 'quotation.updated'
  | 'quotation.deleted'
  | 'product.deleted'
  | 'sale.deleted'
  | 'expense.deleted'
  | 'vendor.deleted'
  | 'purchase.deleted'
  | 'stock.deleted'
  | 'customer.deleted'
  | 'payment.deleted'
  | 'team.member_removed'
  | 'team.invite_revoked'
  | 'ai_chat.deleted'
  | 'company.created'
  | 'company.updated'
  | 'auth.password_changed'
  | 'auth.sign_out';

export type AuditEntityType =
  | 'invoice'
  | 'quotation'
  | 'product'
  | 'sale'
  | 'expense'
  | 'vendor'
  | 'purchase'
  | 'stock'
  | 'customer'
  | 'payment'
  | 'team'
  | 'ai_chat'
  | 'company'
  | 'auth';

export interface AuditLogPayload {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  summary: string;
  /** Field names touched on update (no values — avoids PII in logs). */
  changedFields?: string[];
}

/** Append-only audit record. Never shown in UI; stored for compliance / support. Errors are logged, not thrown. */
export function appendAuditLog(companyId: string, userId: string, payload: AuditLogPayload): void {
  void (async () => {
    try {
      await addDoc(collection(db, COLLECTION), {
        companyId,
        userId,
        ts: serverTimestamp(),
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId ?? null,
        summary: payload.summary,
        changedFields: payload.changedFields?.length ? payload.changedFields : null,
      });
    } catch (e) {
      console.error('[auditLog] write failed', e);
    }
  })();
}

export function auditChangedKeys(updates: Record<string, unknown>): string[] {
  return Object.keys(updates).filter((k) => k !== 'updatedAt');
}

const OPS_PASSWORD_FIELDS = new Set(['operationsPasswordHash', 'operationsPasswordSalt']);

/** Company audit: never log raw hash/salt field names as separate entries; collapse to `operationsPassword`. */
export function auditCompanyChangedKeys(updates: Record<string, unknown>): string[] {
  const keys = auditChangedKeys(updates);
  const touched = keys.some((k) => OPS_PASSWORD_FIELDS.has(k));
  const rest = keys.filter((k) => !OPS_PASSWORD_FIELDS.has(k));
  if (touched) return [...rest, 'operationsPassword'];
  return rest;
}
