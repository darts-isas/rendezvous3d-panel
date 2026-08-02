import * as THREE from 'three';
import { DataFrame, FieldType, TimeRange } from '@grafana/data';
import { ModelShape } from '../../types';
import {
  collectQuaternionSamples,
  getInterpolationTargetMs,
  QuaternionInterpolationStore,
  QuaternionSample,
  sampleQuaternionAt,
} from './QuaternionInterpolation';

const rotationY = (degrees: number) =>
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(degrees));

const makeFrame = (
  name: string,
  fields: Array<{ name: string; type: FieldType; values: Array<number | string | null> }>
): DataFrame => ({
  name,
  fields: fields.map((field) => ({ ...field, config: {} })),
  length: fields[0]?.values.length ?? 0,
} as DataFrame);

const quaternionFrame = (
  name: string,
  times: number[],
  quaternions: THREE.Quaternion[],
  timeName = 'time'
): DataFrame => makeFrame(name, [
  { name: timeName, type: FieldType.time, values: times },
  { name: 'x', type: FieldType.number, values: quaternions.map((q) => q.x) },
  { name: 'y', type: FieldType.number, values: quaternions.map((q) => q.y) },
  { name: 'z', type: FieldType.number, values: quaternions.map((q) => q.z) },
  { name: 'w', type: FieldType.number, values: quaternions.map((q) => q.w) },
]);

const field = (value: string) => ({ sourceType: 'field' as const, value });
const constant = (value: string) => ({ sourceType: 'const' as const, value });
const makeModel = (id: string, overrides: Partial<ModelShape> = {}): ModelShape => ({
  id,
  type: '3dmodel',
  name: id,
  visible: true,
  url: '',
  posX: constant('0'),
  posY: constant('0'),
  posZ: constant('0'),
  quatX: field('x'),
  quatY: field('y'),
  quatZ: field('z'),
  quatW: field('w'),
  interpEnabled: true,
  interpTimeField: '',
  interpBufferSize: 2,
  interpMaxExtrapMs: 5000,
  autoScale: 'on',
  unit: 'km',
  ...overrides,
});

describe('sampleQuaternionAt', () => {
  it('slerps at an intermediate timestamp', () => {
    const samples: QuaternionSample[] = [
      { t: 0, q: rotationY(0) },
      { t: 1000, q: rotationY(90) },
    ];
    expect(sampleQuaternionAt(samples, 500, 5000)!.angleTo(rotationY(45))).toBeLessThan(1e-6);
  });

  it('extrapolates while unit length and clamps at the configured limit', () => {
    const samples: QuaternionSample[] = [
      { t: 0, q: rotationY(0) },
      { t: 1000, q: rotationY(90) },
    ];
    const extrapolated = sampleQuaternionAt(samples, 2000, 5000)!;
    expect(extrapolated.angleTo(rotationY(180))).toBeLessThan(1e-6);
    expect(extrapolated.length()).toBeCloseTo(1);
    expect(sampleQuaternionAt(samples, 5000, 0)!.angleTo(rotationY(90))).toBeLessThan(1e-6);
  });

  it('handles empty, single, and duplicate-time buffers', () => {
    expect(sampleQuaternionAt([], 0, 1000)).toBeNull();
    expect(sampleQuaternionAt([{ t: 0, q: rotationY(30) }], 1000, 1000)!.angleTo(rotationY(30))).toBeLessThan(1e-6);
    expect(sampleQuaternionAt([
      { t: 1000, q: rotationY(0) },
      { t: 1000, q: rotationY(90) },
    ], 1000, 1000)!.angleTo(rotationY(90))).toBeLessThan(1e-6);
  });
});

describe('collectQuaternionSamples', () => {
  it('auto-detects time, keeps the last rows, and normalizes input', () => {
    const frame = quaternionFrame('Series', [0, 1000, 2000], [rotationY(0), rotationY(45), new THREE.Quaternion(0, 2, 0, 2)]);
    const samples = collectQuaternionSamples([frame], { x: 'x', y: 'y', z: 'z', w: 'w' }, '', 2, 0);
    expect(samples.map((sample) => sample.t)).toEqual([1000, 2000]);
    expect(samples[1].q.length()).toBeCloseTo(1);
  });

  it.each([
    ['qualified', { x: 'B.x', y: 'B.y', z: 'B.z', w: 'B.w' }],
    ['bracketed', { x: '[B]{x}', y: '[B]{y}', z: '[B]{z}', w: '[B]{w}' }],
    ['bare', { x: 'x', y: 'y', z: 'z', w: 'w' }],
  ])('resolves %s field specs across multiple series', (_name, specs) => {
    const frames = [
      quaternionFrame('A', [0], [rotationY(0)]),
      quaternionFrame('B', [1000], [rotationY(90)]),
    ];
    const samples = collectQuaternionSamples(frames, specs, 'B.time', 2, 0);
    const expected = specs.x === 'x' ? rotationY(0) : rotationY(90);
    expect(samples).toHaveLength(1);
    expect(samples[0].q.angleTo(expected)).toBeLessThan(1e-6);
  });

  it('supports an explicitly selected time field and skips invalid and zero quaternions', () => {
    const frame = makeFrame('A', [
      { name: 'timestamp', type: FieldType.number, values: [10, 20, 30] },
      { name: 'x', type: FieldType.number, values: [0, 'invalid', 0] },
      { name: 'y', type: FieldType.number, values: [0, 0, 0] },
      { name: 'z', type: FieldType.number, values: [0, 0, 0] },
      { name: 'w', type: FieldType.number, values: [0, 1, 2] },
    ]);
    const samples = collectQuaternionSamples([frame], { x: 'x', y: 'y', z: 'z', w: 'w' }, 'timestamp', 3, 0);
    expect(samples.map((sample) => sample.t)).toEqual([30]);
  });

  it('uses one arrival-timed latest sample if no time field exists', () => {
    const frame = makeFrame('A', [
      { name: 'x', type: FieldType.number, values: [0, 0] },
      { name: 'y', type: FieldType.number, values: [0, 1] },
      { name: 'z', type: FieldType.number, values: [0, 0] },
      { name: 'w', type: FieldType.number, values: [1, 0] },
    ]);
    expect(collectQuaternionSamples([frame], { x: 'x', y: 'y', z: 'z', w: 'w' }, '', 2, 42)[0].t).toBe(42);
  });
});

describe('QuaternionInterpolationStore', () => {
  it('keeps histories independent and resets on field changes or backward time movement', () => {
    const store = new QuaternionInterpolationStore();
    const first = makeModel('first');
    const second = makeModel('second');
    store.update(first, [quaternionFrame('A', [1000, 2000], [rotationY(0), rotationY(90)])], 0);
    store.update(second, [quaternionFrame('A', [3000], [rotationY(180)])], 0);
    expect(store.getSamples('first').map((sample) => sample.t)).toEqual([1000, 2000]);
    expect(store.getSamples('second').map((sample) => sample.t)).toEqual([3000]);

    store.update(first, [quaternionFrame('A', [500], [rotationY(45)])], 0);
    expect(store.getSamples('first').map((sample) => sample.t)).toEqual([500]);

    const renamedFrame = makeFrame('A', [
      { name: 'time', type: FieldType.time, values: [4000] },
      { name: 'qx', type: FieldType.number, values: [0] },
      { name: 'y', type: FieldType.number, values: [0] },
      { name: 'z', type: FieldType.number, values: [0] },
      { name: 'w', type: FieldType.number, values: [1] },
    ]);
    store.update({ ...first, quatX: field('qx') }, [renamedFrame], 0);
    expect(store.getSamples('first').map((sample) => sample.t)).toEqual([4000]);
  });

  it('clears history when disabled or when a quaternion component is constant', () => {
    const store = new QuaternionInterpolationStore();
    const model = makeModel('model');
    store.update(model, [quaternionFrame('A', [1000], [rotationY(0)])], 0);
    store.update({ ...model, quatW: constant('1') }, [], 0);
    expect(store.getSamples('model')).toEqual([]);
  });
});

describe('getInterpolationTargetMs', () => {
  const range = (rawTo: string, to: number) => ({
    raw: { from: 'now-5m', to: rawTo },
    from: { valueOf: () => to - 300_000 },
    to: { valueOf: () => to },
  } as unknown as TimeRange);

  it('advances relative now ranges with wall time', () => {
    expect(getInterpolationTargetMs(range('now', 10_000), 1000, 1500)).toBe(10_500);
  });

  it('keeps absolute ranges fixed', () => {
    expect(getInterpolationTargetMs(range('2026-01-01T00:00:00Z', 10_000), 1000, 1500)).toBe(10_000);
  });
});
