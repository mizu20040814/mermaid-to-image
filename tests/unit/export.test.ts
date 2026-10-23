import { expect, test } from 'vitest';
import { prepareSvgForExport, pngScale } from '../../src/export';

const raw = '<svg id="d" viewBox="0 0 300 120" style="max-width: 300px;" width="100%"><text>開始</text></svg>';

test('viewBox から幅と高さを付け、max-width を外す', () => {
  const r = prepareSvgForExport(raw);
  expect(r.width).toBe(300);
  expect(r.height).toBe(120);
  expect(r.svg).toContain('width="300"');
  expect(r.svg).toContain('height="120"');
  expect(r.svg).not.toContain('max-width');
  expect(r.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(r.svg).toContain('開始');
});

test('pngScale は通常 2 倍、長辺 8192px を超えるなら縮める', () => {
  expect(pngScale(300, 120)).toBe(2);
  expect(pngScale(8192, 100)).toBe(1);
  expect(pngScale(16384, 100)).toBe(0.5);
});
