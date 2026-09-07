import { StoreSettings } from '../types';

/**
 * The public preview origin for Su-Qur POS that is 100% accessible to customers
 * without requiring any Google, GitHub, or email authentication.
 */
export const PUBLIC_APP_ORIGIN =
  'https://ais-pre-jdvpo3osb7mixb25ygw276-287099603695.asia-southeast1.run.app';

/**
 * Resolves the public, unauthenticated origin for customer self-order links & QR codes.
 * Ensures that internal development URLs ('ais-dev-') are always converted to public preview
 * URLs ('ais-pre-') so that customers on mobile phones are NEVER prompted to log in via
 * Google, GitHub, or email.
 */
export function resolvePublicOrderOrigin(settings?: StoreSettings | null): string {
  let origin = settings?.publicOrderUrl?.trim();

  // If not configured or left as default dummy placeholder
  if (!origin || origin === 'https://suqur-pos.app') {
    if (typeof window !== 'undefined' && window.location.origin) {
      origin = window.location.origin;
    } else {
      origin = PUBLIC_APP_ORIGIN;
    }
  }

  // CRITICAL: Convert internal AI Studio developer preview URLs (ais-dev-)
  // to public shared URLs (ais-pre-).
  // ais-dev- requires Google Cloud / GitHub developer authentication.
  // ais-pre- is 100% public for customers without any login!
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }

  // Ensure protocol is present
  if (!/^https?:\/\//i.test(origin)) {
    origin = `https://${origin}`;
  }

  // Remove trailing slash
  return origin.replace(/\/+$/, '');
}

/**
 * Builds the complete customer self-order URL with query params
 * e.g.: https://ais-pre-...asia-southeast1.run.app?outletId=outlet-lagoa&table=Meja%2001&mode=order
 */
export function buildCustomerSelfOrderUrl(
  outletId: string,
  table: string = 'Meja 01',
  settings?: StoreSettings | null
): string {
  const base = resolvePublicOrderOrigin(settings);
  return `${base}?outletId=${encodeURIComponent(outletId)}&table=${encodeURIComponent(
    table
  )}&mode=order`;
}

/**
 * Builds the complete customer pre-order (PO) URL with query params
 */
export function buildCustomerPOUrl(
  outletId: string,
  settings?: StoreSettings | null
): string {
  const base = resolvePublicOrderOrigin(settings);
  return `${base}?page=po-order&outlet=${encodeURIComponent(outletId)}`;
}
