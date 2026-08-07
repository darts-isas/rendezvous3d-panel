import { clampBrightness, DataFieldProcessor } from './ThreeSceneHelpers';

const constant = (value: string) => ({ sourceType: 'const' as const, value });

describe('clampBrightness', () => {
  it('passes values already within 0-1 through unchanged', () => {
    expect(clampBrightness(0)).toBe(0);
    expect(clampBrightness(0.5)).toBe(0.5);
    expect(clampBrightness(1)).toBe(1);
  });

  it('saturates values above 1 to 1 and below 0 to 0', () => {
    expect(clampBrightness(2)).toBe(1);
    expect(clampBrightness(-1)).toBe(0);
  });

  it('falls back to unchanged (1) for non-finite values', () => {
    expect(clampBrightness(NaN)).toBe(1);
    expect(clampBrightness(Infinity)).toBe(1);
    expect(clampBrightness(-Infinity)).toBe(1);
  });
});

describe('DataFieldProcessor.getBrightnessValue', () => {
  it('returns 1 when the field is undefined', () => {
    const processor = new DataFieldProcessor();
    expect(processor.getBrightnessValue(undefined)).toBe(1);
  });

  it('resolves and clamps a const field', () => {
    const processor = new DataFieldProcessor();
    expect(processor.getBrightnessValue(constant('0.3'))).toBeCloseTo(0.3);
    expect(processor.getBrightnessValue(constant('2'))).toBe(1);
    expect(processor.getBrightnessValue(constant('-1'))).toBe(0);
  });
});
