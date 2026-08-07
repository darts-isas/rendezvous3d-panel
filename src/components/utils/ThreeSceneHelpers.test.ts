import { clampOpacity, DataFieldProcessor } from './ThreeSceneHelpers';

const constant = (value: string) => ({ sourceType: 'const' as const, value });

describe('clampOpacity', () => {
  it('passes values already within 0-1 through unchanged', () => {
    expect(clampOpacity(0)).toBe(0);
    expect(clampOpacity(0.5)).toBe(0.5);
    expect(clampOpacity(1)).toBe(1);
  });

  it('saturates values above 1 to 1 and below 0 to 0', () => {
    expect(clampOpacity(2)).toBe(1);
    expect(clampOpacity(-1)).toBe(0);
  });

  it('falls back to fully opaque (1) for non-finite values', () => {
    expect(clampOpacity(NaN)).toBe(1);
    expect(clampOpacity(Infinity)).toBe(1);
    expect(clampOpacity(-Infinity)).toBe(1);
  });
});

describe('DataFieldProcessor.getOpacityValue', () => {
  it('returns 1 when the field is undefined', () => {
    const processor = new DataFieldProcessor();
    expect(processor.getOpacityValue(undefined)).toBe(1);
  });

  it('resolves and clamps a const field', () => {
    const processor = new DataFieldProcessor();
    expect(processor.getOpacityValue(constant('0.3'))).toBeCloseTo(0.3);
    expect(processor.getOpacityValue(constant('2'))).toBe(1);
    expect(processor.getOpacityValue(constant('-1'))).toBe(0);
  });
});
