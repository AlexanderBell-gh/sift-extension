// Extraction trace + field-by-field dump. The trace is written inside the
// engine (extract.ts), so the dump reports the selector extraction actually
// used instead of re-querying the page.
import type { ExtractedProduct } from '../types';

export type Trace = Record<string, string>;

let trace: Trace | null = null;

export function startTrace(): void {
  trace = {};
}

export function stopTrace(): Trace | null {
  const finished = trace;
  trace = null;
  return finished;
}

export function markTrace(field: string, selector: string): void {
  if (trace) trace[field] = selector;
}

export function isDebugEnabled(): boolean {
  try {
    return (
      new URLSearchParams(location.search).get('sift_debug') === '1' ||
      localStorage.getItem('sift_debug') === '1'
    );
  } catch {
    return false;
  }
}

function fmtPrice(value: number | null): string {
  return value == null ? '(none)' : `£${value.toFixed(2)}`;
}

function line(label: string, value: string | null, selector?: string): string {
  const shown = value == null || value === '' ? '(none)' : value;
  return `${label.padEnd(15)}${shown}${selector ? `  <- ${selector}` : ''}`;
}

export function formatProductDump(
  product: ExtractedProduct | null,
  trace: Trace,
  storeId: string
): string {
  const signals = product?.category_signals;
  const lines = [
    line('STORE:', storeId),
    line('PRODUCT-TITLE:', product?.name ?? null, trace.title),
    line('PRODUCT-IMG:', product?.image_url ?? null, trace.image),
    line('CURRENT-PRICE:', fmtPrice(product?.price ?? null), trace.price),
    line('WAS-PRICE:', fmtPrice(product?.was_price ?? null), trace.was),
    line('LOYALTY-PRICE:', fmtPrice(product?.loyalty_price ?? null), trace.loyalty),
    line('MULTI-BUY:', product?.offer_deal ?? null, trace.deal),
    line('OFFER-EXPIRY:', product?.offer_expires_at ?? null, trace.expiry),
    line(
      'CATEGORY-SIG:',
      signals
        ? `leaf="${signals.breadcrumb_leaf ?? ''}" brand="${signals.brand ?? ''}" storage="${signals.storage_text ?? ''}"`
        : null
    ),
  ];
  return `SIFT DUMP\n${lines.join('\n')}`;
}
