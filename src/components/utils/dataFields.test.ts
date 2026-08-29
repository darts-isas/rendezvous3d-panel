import { DataFrame, Field, FieldType } from '@grafana/data';
import { getAllFieldOptions, getLastRawFieldValue, resolveField, resolveFieldInFrame } from './dataFields';

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

describe('resolveFieldInFrame', () => {
  it('resolves a bare field name', () => {
    const frame = makeFrame('A', [{ name: 'q_x', type: FieldType.number, values: [1] }]);
    expect(resolveFieldInFrame(frame, 'q_x')?.name).toBe('q_x');
  });

  it('resolves a qualified field name', () => {
    const frame = makeFrame('A', [{ name: 'q_x', type: FieldType.number, values: [1] }]);
    expect(resolveFieldInFrame(frame, 'A.q_x')?.name).toBe('q_x');
  });

  it('matches a positional "Query-N" label when the frame index is passed', () => {
    const frame = makeFrame(undefined, [{ name: 'q_x', type: FieldType.number, values: [1] }]);
    expect(resolveFieldInFrame(frame, 'Query-1.q_x', 0)?.name).toBe('q_x');
  });
});

describe('resolveField', () => {
  it('resolves a qualified spec', () => {
    const frames = [makeFrame('A', [{ name: 'q_x', type: FieldType.number, values: [1] }])];
    expect(resolveField(frames, 'A.q_x')?.name).toBe('q_x');
  });

  it('resolves a bare spec', () => {
    const frames = [makeFrame('A', [{ name: 'q_x', type: FieldType.number, values: [1] }])];
    expect(resolveField(frames, 'q_x')?.name).toBe('q_x');
  });

  it('returns undefined for an empty spec or missing series', () => {
    expect(resolveField(undefined, 'q_x')).toBeUndefined();
    expect(resolveField([], '')).toBeUndefined();
  });

  it('disambiguates same-named fields across frames using the qualified form', () => {
    const frames = [
      makeFrame('A', [{ name: 'mode', type: FieldType.string, values: ['SAFE'] }]),
      makeFrame('B', [{ name: 'mode', type: FieldType.string, values: ['NOMINAL'] }]),
    ];
    expect(resolveField(frames, 'B.mode')?.values).toEqual(['NOMINAL']);
  });
});

describe('getLastRawFieldValue', () => {
  it('returns the raw last value for a string field, unlike a numeric-coercing getter', () => {
    const field = { name: 'mode', type: FieldType.string, values: ['SAFE', 'NOMINAL'], config: {} } as unknown as Field;
    expect(getLastRawFieldValue(field)).toBe('NOMINAL');
  });

  it('returns undefined for an empty or missing values array', () => {
    const field = { name: 'x', type: FieldType.number, values: [], config: {} } as unknown as Field;
    expect(getLastRawFieldValue(field)).toBeUndefined();
  });
});

describe('getAllFieldOptions', () => {
  it('lists fields of every type, not just numeric', () => {
    const frames = [
      makeFrame('A', [
        { name: 'q_x', type: FieldType.number, values: [1] },
        { name: 'mode', type: FieldType.string, values: ['SAFE'] },
        { name: 'time', type: FieldType.time, values: [0] },
      ]),
    ];
    const options = getAllFieldOptions(frames);
    expect(options.map((o) => o.value)).toEqual(['A.q_x', 'A.mode', 'A.time']);
  });

  it('returns an empty array for missing series', () => {
    expect(getAllFieldOptions(undefined)).toEqual([]);
  });

  it('deduplicates identical qualified field names', () => {
    const frames = [makeFrame('A', [{ name: 'q_x', type: FieldType.number, values: [1] }])];
    expect(getAllFieldOptions([...frames, ...frames])).toHaveLength(1);
  });
});
