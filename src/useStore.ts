import { useCallback, useEffect, useState } from 'react';
import type { Access } from './game/access';
import * as store from './store';

export type Shop = Access & {
  /** The price as the store words it, once it has answered. */
  price: string | null;
  buy: () => Promise<store.BuyResult>;
  /** True when an earlier purchase was found. */
  restore: () => Promise<boolean>;
};

/** Whether the paid songs are open, and how to open them. */
export function useStore(): Shop {
  const [owned, setOwned] = useState(store.rememberedOwned);
  const [price, setPrice] = useState<string | null>(null);

  useEffect(() => {
    if (!store.PAYWALL) return;
    let gone = false;
    // without a connection the last known answer stands
    const refresh = () => store.checkOwned().then((o) => { if (!gone) setOwned(o); }).catch(() => {});
    void refresh();
    store.loadPrice().then((p) => { if (!gone) setPrice(p); }).catch(() => {});
    let stop = () => {};
    void store.watchPurchases(() => void refresh()).then((s) => { if (gone) s(); else stop = s; }).catch(() => {});
    return () => { gone = true; stop(); };
  }, []);

  const buy = useCallback(async () => {
    const r = await store.buy();
    if (r === 'bought') setOwned(true);
    return r;
  }, []);
  const restore = useCallback(async () => {
    const found = await store.restore();
    setOwned(found);
    return found;
  }, []);

  return { paywall: store.PAYWALL, owned: !store.PAYWALL || owned, price, buy, restore };
}
