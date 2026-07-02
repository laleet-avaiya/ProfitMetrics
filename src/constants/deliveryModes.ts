import { DeliveryMode } from '../types';

export const DELIVERY_MODE_OPTIONS = [
  {
    value: DeliveryMode.INDIVIDUAL,
    label: 'Individual',
    description: 'Each item uses its own delivery fee × quantity',
  },
  {
    value: DeliveryMode.GROUP,
    label: 'Group',
    description: 'One combined delivery charge for the whole order',
  },
] as const;

export function deliveryModeLabel(mode?: DeliveryMode): string {
  return mode === DeliveryMode.GROUP ? 'Group delivery' : 'Individual delivery';
}

export function normalizeDeliveryMode(mode?: DeliveryMode): DeliveryMode {
  return mode === DeliveryMode.GROUP ? DeliveryMode.GROUP : DeliveryMode.INDIVIDUAL;
}
