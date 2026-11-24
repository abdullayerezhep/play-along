import { PRODUCT_ID, ownsAllSongs } from './game/access';
import { isNative } from './native';

/**
 * The one-time purchase that opens the Medium and Hard songs.
 *
 * Only the store apps sell anything; the website has no shop and stays fully open.
 * While developing, open the page with `?paywall` to see the locks with a pretend
 * store: no money, no network.
 */
const DEMO = import.meta.env.DEV && new URLSearchParams(location.search).has('paywall');
export const PAYWALL = isNative || DEMO;

export type BuyResult = 'bought' | 'cancelled' | 'pending';

const KEY = 'play-along:owned';
/** What the store said last time, so the songs stay open without a connection. */
export function rememberedOwned(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
function remember(owned: boolean) {
  try { if (owned) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* private mode */ }
}

// Loaded on demand: the website never needs the native purchase code.
const native = () => import('@capgo/native-purchases');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The price as the store words it for this customer's country, e.g. "4 990 ₸". */
export async function loadPrice(): Promise<string> {
  if (DEMO) return '4 990 ₸';
  const { NativePurchases, PURCHASE_TYPE } = await native();
  const { product } = await NativePurchases.getProduct({ productIdentifier: PRODUCT_ID, productType: PURCHASE_TYPE.INAPP });
  return product.priceString;
}

/** Ask the store whether this account owns the purchase. The store is the truth: a refund locks the songs again. */
export async function checkOwned(): Promise<boolean> {
  if (DEMO) return rememberedOwned();
  const { NativePurchases, PURCHASE_TYPE } = await native();
  const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP, onlyCurrentEntitlements: true });
  const owned = ownsAllSongs(purchases);
  remember(owned);
  return owned;
}

/** Open the store's payment sheet. Throws only when something actually went wrong. */
export async function buy(): Promise<BuyResult> {
  if (DEMO) { await wait(700); remember(true); return 'bought'; }
  const { NativePurchases, PURCHASE_TYPE } = await native();
  try {
    const t = await NativePurchases.purchaseProduct({ productIdentifier: PRODUCT_ID, productType: PURCHASE_TYPE.INAPP, quantity: 1 });
    if (!ownsAllSongs([t])) return 'pending'; // e.g. a cash payment on Android that has not arrived yet
    remember(true);
    return 'bought';
  } catch (e) {
    const err = e as { message?: string; code?: string };
    const text = `${err.code ?? ''} ${err.message ?? ''}`;
    if (/cancel/i.test(text)) return 'cancelled';
    if (/pending/i.test(text)) return 'pending'; // iOS: waiting for a parent's approval
    if (/already.?owned/i.test(text) && await checkOwned()) return 'bought';
    throw e;
  }
}

/** Bring back a purchase made earlier, on another phone or before reinstalling. True when one was found. */
export async function restore(): Promise<boolean> {
  if (DEMO) { await wait(500); return rememberedOwned(); }
  const { NativePurchases } = await native();
  await NativePurchases.restorePurchases();
  return checkOwned();
}

/** Tell `changed` when a payment that was waiting (a parent's approval) goes through while the app is open. */
export async function watchPurchases(changed: () => void): Promise<() => void> {
  if (!isNative) return () => {};
  const { NativePurchases } = await native();
  const handle = await NativePurchases.addListener('transactionUpdated', changed);
  return () => void handle.remove();
}
