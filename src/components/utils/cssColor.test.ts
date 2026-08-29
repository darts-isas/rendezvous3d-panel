import { toCssColor } from './cssColor';

describe('toCssColor', () => {
  it('converts a 6-digit hex color, applying the given opacity', () => {
    expect(toCssColor('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });

  it('converts an 8-digit hex color, discarding its own alpha in favor of the given opacity', () => {
    expect(toCssColor('#00ff0080', 1)).toBe('rgba(0, 255, 0, 1)');
  });

  it('passes an rgb() color through, applying the given opacity', () => {
    expect(toCssColor('rgb(10, 20, 30)', 0.25)).toBe('rgba(10, 20, 30, 0.25)');
  });

  it('re-applies opacity to an already-rgba() color', () => {
    expect(toCssColor('rgba(10, 20, 30, 0.9)', 0.25)).toBe('rgba(10, 20, 30, 0.25)');
  });

  it('resolves a named Grafana theme color', () => {
    expect(toCssColor('green', 1)).toBe('rgba(115, 191, 105, 1)');
  });

  it('keeps "transparent" fully transparent regardless of opacity', () => {
    expect(toCssColor('transparent', 1)).toBe('rgba(0, 0, 0, 0)');
  });

  it('clamps out-of-range opacity into 0-1', () => {
    expect(toCssColor('#ffffff', 5)).toBe('rgba(255, 255, 255, 1)');
    expect(toCssColor('#ffffff', -5)).toBe('rgba(255, 255, 255, 0)');
  });

  it('falls back to a non-finite opacity of 1', () => {
    expect(toCssColor('#ffffff', NaN)).toBe('rgba(255, 255, 255, 1)');
  });

  it('returns an unrecognized color string unchanged', () => {
    expect(toCssColor('not-a-color', 0.5)).toBe('not-a-color');
  });
});
