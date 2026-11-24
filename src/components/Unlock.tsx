import { useEffect, useRef, useState } from 'react';
import { isPaid } from '../game/access';
import { SONGS } from '../game/songs';
import type { Shop } from '../useStore';

type Props = { shop: Shop; onClose: () => void };

const PAID = SONGS.filter(isPaid).length;

/** The one place the purchase is offered: what you get, the price, buy, and restore. */
export function Unlock({ shop, onClose }: Props) {
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [note, setNote] = useState('');
  const buyRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buyRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const buy = async () => {
    setBusy('buy'); setNote('');
    try {
      const r = await shop.buy();
      if (r === 'bought') onClose();
      else if (r === 'pending') setNote('The payment is waiting for approval. The songs open as soon as it goes through.');
    } catch {
      setNote("The purchase didn't go through. Check your connection and try again.");
    }
    setBusy(null);
  };
  const restore = async () => {
    setBusy('restore'); setNote('');
    try {
      if (await shop.restore()) onClose();
      else setNote('No earlier purchase was found for this account.');
    } catch {
      setNote("The store can't be reached. Check your connection and try again.");
    }
    setBusy(null);
  };

  return (
    <div className="card-backdrop" onClick={busy ? undefined : onClose}>
      <div className="unlock" role="dialog" aria-modal="true" aria-labelledby="unlock-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="unlock-title">Open all {SONGS.length} songs</h2>
        <p>The {PAID} Medium and Hard songs open with one payment. Pay once and they are yours: there is no subscription.</p>
        <p className="dim">Warm-ups, Easy songs and the songs you type in yourself stay free.</p>
        <button ref={buyRef} className="btn go" onClick={buy} disabled={!!busy}>
          {busy === 'buy' ? 'Opening the store…' : shop.price ? `Unlock for ${shop.price}` : 'Unlock all songs'}
        </button>
        <p className="unlock-note" role="status">{note}</p>
        <div className="actions">
          <button className="link" onClick={restore} disabled={!!busy}>{busy === 'restore' ? 'Looking…' : 'I already bought this'}</button>
          <button className="link" onClick={onClose} disabled={!!busy}>Not now</button>
        </div>
      </div>
    </div>
  );
}
