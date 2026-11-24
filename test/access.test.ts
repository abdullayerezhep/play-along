import { describe, expect, it } from 'vitest';
import { PRODUCT_ID, isLocked, isPaid, ownsAllSongs } from '../src/game/access';
import { SONGS } from '../src/game/songs';

const shop = { paywall: true, owned: false };

describe('which songs are sold', () => {
  it('keeps warm-ups and Easy free and sells Medium and Hard', () => {
    const free = SONGS.filter((s) => !isPaid(s));
    const paid = SONGS.filter(isPaid);
    expect(new Set(free.map((s) => s.level))).toEqual(new Set(['warmup', 'easy']));
    expect(new Set(paid.map((s) => s.level))).toEqual(new Set(['medium', 'hard']));
    // a newcomer has plenty to play before being asked for money
    expect(free.length).toBeGreaterThanOrEqual(20);
  });

  it('never locks a song the player typed in', () => {
    expect(isLocked({}, shop)).toBe(false);
  });

  it('locks paid songs only where there is a shop and nothing was bought', () => {
    const medium = { level: 'medium' as const };
    expect(isLocked(medium, shop)).toBe(true);
    expect(isLocked(medium, { paywall: true, owned: true })).toBe(false);
    expect(isLocked(medium, { paywall: false, owned: false })).toBe(false); // the website
    expect(isLocked({ level: 'easy' }, shop)).toBe(false);
  });
});

describe('what the store says about ownership', () => {
  const bought = { productIdentifier: PRODUCT_ID };

  it('accepts a plain purchase (iOS) and a paid one (Android)', () => {
    expect(ownsAllSongs([bought])).toBe(true);
    expect(ownsAllSongs([{ ...bought, purchaseState: '1' }])).toBe(true);
  });

  it('does not open the songs for nothing, another product, a refund or an unpaid order', () => {
    expect(ownsAllSongs([])).toBe(false);
    expect(ownsAllSongs([{ productIdentifier: 'something_else' }])).toBe(false);
    expect(ownsAllSongs([{ ...bought, revocationDate: '2026-12-01T10:00:00Z' }])).toBe(false);
    expect(ownsAllSongs([{ ...bought, purchaseState: '0' }])).toBe(false);
    expect(ownsAllSongs([{ ...bought, purchaseState: '2' }])).toBe(false);
  });
});
