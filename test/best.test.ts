import { expect, test } from 'vitest';
import { recordBest } from '../src/best';

test('only a better result replaces the best grade for a song', () => {
  let r = recordBest({}, 'saints', 'B', 0.72);
  expect(r).toMatchObject({ improved: true, best: { saints: { grade: 'B' } } });
  r = recordBest(r.best, 'saints', 'C', 0.6);
  expect(r.improved).toBe(false);
  r = recordBest(r.best, 'saints', 'B', 0.8);
  expect(r).toMatchObject({ improved: true, best: { saints: { accuracy: 0.8 } } });
  r = recordBest(r.best, 'saints', 'S', 0.97);
  expect(r.best.saints.grade).toBe('S');
  expect(recordBest(r.best, 'canon', 'D', 0.2).best).toMatchObject({ saints: { grade: 'S' }, canon: { grade: 'D' } });
});
