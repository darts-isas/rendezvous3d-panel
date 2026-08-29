import { DataFrame, FieldType } from '@grafana/data';
import { buildKeyParamLines, formatValue, SEPARATOR_MAP } from './keyParams';
import { KeyParam } from '../../types';

const makeFrame = (
  refId: string | undefined,
  fields: Array<{ name: string; type: FieldType; values: unknown[] }>,
  name?: string
): DataFrame => {
  return {
    name,
    refId,
    fields: fields.map((f) => ({ name: f.name, type: f.type, values: f.values, config: {} })),
    length: fields.length > 0 ? fields[0].values.length : 0,
  } as unknown as DataFrame;
};

const makeKeyParam = (id: string, name: string, overrides: Partial<KeyParam> = {}): KeyParam => ({
  id,
  name,
  visible: true,
  field: '',
  format: '%.2f',
  ...overrides,
});

describe('formatValue', () => {
  it('formats %.2f', () => {
    expect(formatValue('%.2f', 12.345, 8)).toBe('   12.35');
  });

  it('formats %d, rounding to the nearest integer', () => {
    expect(formatValue('%d', 12.6, 4)).toBe('  13');
  });

  it('formats %s', () => {
    expect(formatValue('%s', 'SAFE', 8)).toBe('    SAFE');
  });

  it('formats %+.1e', () => {
    expect(formatValue('%+.1e', 123, 10)).toBe('   +1.2e+2');
  });

  it('keeps literal text around the specifier', () => {
    expect(formatValue('%.2f deg', 1, 4)).toBe('1.00 deg');
  });

  it('only substitutes the first specifier; later ones stay literal', () => {
    expect(formatValue('%.2f (%s)', 1, 4)).toBe('1.00 (%s)');
  });

  it('renders a literal % from %%', () => {
    expect(formatValue('%%%d', 5, 1)).toBe('%5');
  });

  it('truncates from the left when the value overflows valueWidth', () => {
    expect(formatValue('%.4f', 123.456789, 5)).toBe('123.4');
  });

  it('renders "-" for a missing value regardless of the specifier', () => {
    expect(formatValue('%.2f', undefined, 5)).toBe('    -');
    expect(formatValue('%s', undefined, 5)).toBe('    -');
  });

  it('falls back to String(value) for a non-numeric value with a numeric specifier', () => {
    expect(formatValue('%.2f', 'n/a', 4)).toBe(' n/a');
  });

  it('does not pad when valueWidth is 0 or negative', () => {
    expect(formatValue('%.2f', 1, 0)).toBe('1.00');
    expect(formatValue('%.2f', 1, -1)).toBe('1.00');
  });
});

describe('buildKeyParamLines', () => {
  it('builds one padded line per visible item, aligned to the longest name', () => {
    const series = [
      makeFrame('A', [
        { name: 'roll', type: FieldType.number, values: [12.3] },
        { name: 'pitch', type: FieldType.number, values: [-1.5] },
      ]),
    ];
    const items = [
      { ...makeKeyParam('1', 'Roll'), field: 'roll', format: '%.2f' },
      { ...makeKeyParam('2', 'Pitch'), field: 'pitch', format: '%.2f' },
    ];

    const lines = buildKeyParamLines(items, series, { separator: SEPARATOR_MAP.colon, valueWidth: 6 });

    expect(lines).toEqual(['Roll :  12.30', 'Pitch:  -1.50']);
  });

  it('skips items with visible: false', () => {
    const series = [makeFrame('A', [{ name: 'roll', type: FieldType.number, values: [1] }])];
    const items = [
      { ...makeKeyParam('1', 'Roll'), field: 'roll' },
      { ...makeKeyParam('2', 'Hidden'), field: 'roll', visible: false },
    ];

    const lines = buildKeyParamLines(items, series, { separator: SEPARATOR_MAP.colon, valueWidth: 4 });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Roll');
  });

  it('returns an empty array when there are no visible items', () => {
    expect(buildKeyParamLines([], [], { separator: SEPARATOR_MAP.colon, valueWidth: 4 })).toEqual([]);
  });

  it('renders "-" when the field cannot be resolved', () => {
    const items = [{ ...makeKeyParam('1', 'Missing'), field: 'does_not_exist' }];

    const lines = buildKeyParamLines(items, [], { separator: SEPARATOR_MAP.equal, valueWidth: 4 });

    expect(lines).toEqual(['Missing =    -']);
  });

  it('keeps the line count and name-column width fixed as values change', () => {
    const items = [{ ...makeKeyParam('1', 'Roll'), field: 'roll' }];
    const short = [makeFrame('A', [{ name: 'roll', type: FieldType.number, values: [1] }])];
    const long = [makeFrame('A', [{ name: 'roll', type: FieldType.number, values: [-100000.123] }])];

    const shortLine = buildKeyParamLines(items, short, { separator: SEPARATOR_MAP.colon, valueWidth: 8 });
    const longLine = buildKeyParamLines(items, long, { separator: SEPARATOR_MAP.colon, valueWidth: 8 });

    expect(shortLine[0].length).toBe(longLine[0].length);
  });
});
