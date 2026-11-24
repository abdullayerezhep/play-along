import type { Level, Song } from './songs';

/** The levels that open with the one-time purchase. Warm-ups, Easy and your own songs are free. */
export const PAID_LEVELS: readonly Level[] = ['medium', 'hard'];

export const isPaid = (song: Pick<Song, 'level'>) => !!song.level && PAID_LEVELS.includes(song.level);

export type Access = {
  /** Songs are sold here. False on the website, where everything is open. */
  paywall: boolean;
  /** The purchase has been made. */
  owned: boolean;
};

export const isLocked = (song: Pick<Song, 'level'>, access: Access) => access.paywall && !access.owned && isPaid(song);

/** The id of the one-time purchase in App Store Connect and Play Console. */
export const PRODUCT_ID = 'all_songs';

/** What the store reports about one purchase. Only the fields that decide ownership. */
export type StorePurchase = {
  productIdentifier: string;
  /** iOS: set when the purchase was refunded or taken back. */
  revocationDate?: string;
  /** Android: "1" is paid; anything else (pending, unknown) is not yet. iOS leaves it out. */
  purchaseState?: string;
};

/** Does this list of purchases from the store include a valid purchase of all songs? */
export const ownsAllSongs = (purchases: StorePurchase[]) =>
  purchases.some((p) => p.productIdentifier === PRODUCT_ID && !p.revocationDate && (p.purchaseState === undefined || p.purchaseState === '1'));
