import * as THREE from 'three';
import { DataFrame, Field, FieldType, TimeRange } from '@grafana/data';
import { ModelShape } from '../../types';

export type QuaternionSample = { t: number; q: THREE.Quaternion };

type QuaternionFields = { x: string; y: string; z: string; w: string };

const frameLabel = (frame: DataFrame, index: number): string =>
  frame.name ?? frame.refId ?? `Query-${index + 1}`;

const fieldByQualifiedName = (frame: DataFrame, spec: string, index: number): Field | undefined => {
  const bracketMatch = spec.match(/^\[([^\]]+)]\{([^}]+)}$/);
  if (bracketMatch) {
    const [, seriesName, fieldName] = bracketMatch;
    if (seriesName === frame.name || seriesName === frame.refId || seriesName === frameLabel(frame, index)) {
      return frame.fields.find((field) => field.name === fieldName);
    }
    return undefined;
  }

  for (const label of new Set([frame.name, frame.refId, frameLabel(frame, index)])) {
    if (!label) {continue;}
    const prefix = `${label}.`;
    if (spec.startsWith(prefix)) {
      return frame.fields.find((field) => field.name === spec.slice(prefix.length));
    }
  }

  return undefined;
};

export const resolveFieldInFrame = (frame: DataFrame, spec: string, index: number): Field | undefined =>
  fieldByQualifiedName(frame, spec, index) ?? frame.fields.find((field) => field.name === spec);

const valueAt = (field: Field, index: number): unknown => {
  const values = field.values as any;
  return values[index] ?? values.get?.(index);
};

export const isQuaternionInterpolationActive = (shape: ModelShape): boolean =>
  shape.interpEnabled === true &&
  shape.quatX?.sourceType === 'field' && shape.quatY?.sourceType === 'field' &&
  shape.quatZ?.sourceType === 'field' && shape.quatW?.sourceType === 'field';

export const sampleQuaternionAt = (
  buffer: QuaternionSample[],
  targetMs: number,
  maxExtrapMs: number
): THREE.Quaternion | null => {
  if (buffer.length === 0) {return null;}
  if (buffer.length === 1) {return buffer[0].q.clone();}

  const last = buffer[buffer.length - 1];
  const extrapolationLimit = Math.max(0, Number(maxExtrapMs) || 0);
  const effectiveTarget = Math.min(targetMs, last.t + extrapolationLimit);
  let a = buffer[0];
  let b = buffer[1];

  if (effectiveTarget >= last.t) {
    a = buffer[buffer.length - 2];
    b = last;
  } else if (effectiveTarget > buffer[0].t) {
    for (let index = 0; index < buffer.length - 1; index++) {
      if (buffer[index].t <= effectiveTarget && effectiveTarget <= buffer[index + 1].t) {
        a = buffer[index];
        b = buffer[index + 1];
        break;
      }
    }
  }

  const dt = b.t - a.t;
  if (dt < 1) {return b.q.clone();}
  const ratio = Math.max(0, (effectiveTarget - a.t) / dt);
  return a.q.clone().slerp(b.q, ratio);
};

export const collectQuaternionSamples = (
  frames: DataFrame[],
  fields: QuaternionFields,
  timeFieldName: string,
  maxRows: number,
  fallbackTimeMs: number
): QuaternionSample[] => {
  const frameIndex = frames.findIndex((frame, index) =>
    Object.values(fields).every((spec) => resolveFieldInFrame(frame, spec, index) !== undefined)
  );
  if (frameIndex < 0) {return [];}

  const frame = frames[frameIndex];
  const xField = resolveFieldInFrame(frame, fields.x, frameIndex);
  const yField = resolveFieldInFrame(frame, fields.y, frameIndex);
  const zField = resolveFieldInFrame(frame, fields.z, frameIndex);
  const wField = resolveFieldInFrame(frame, fields.w, frameIndex);
  if (!xField || !yField || !zField || !wField) {return [];}
  const quaternionFields = [xField, yField, zField, wField];

  const timeField = timeFieldName
    ? resolveFieldInFrame(frame, timeFieldName, frameIndex)
    : frame.fields.find((field) => field.type === FieldType.time);
  const length = Math.min(...quaternionFields.map((field) => field.values.length));
  if (length === 0) {return [];}

  const makeSample = (index: number, timestamp: number): QuaternionSample | null => {
    const values = quaternionFields.map((field) => Number(valueAt(field, index)));
    if (values.some((value) => !Number.isFinite(value)) || !Number.isFinite(timestamp)) {return null;}

    const quaternion = new THREE.Quaternion(values[0], values[1], values[2], values[3]);
    if (quaternion.lengthSq() === 0) {return null;}
    return { t: timestamp, q: quaternion.normalize() };
  };

  if (!timeField) {
    const sample = makeSample(length - 1, fallbackTimeMs);
    return sample ? [sample] : [];
  }

  const start = Math.max(0, length - Math.max(1, Math.floor(maxRows)));
  const samples: QuaternionSample[] = [];
  for (let index = start; index < length; index++) {
    const sample = makeSample(index, Number(valueAt(timeField, index)));
    if (sample) {samples.push(sample);}
  }
  return samples.sort((a, b) => a.t - b.t);
};

type BufferEntry = { key: string; samples: QuaternionSample[] };

export class QuaternionInterpolationStore {
  private entries = new Map<string, BufferEntry>();

  update(shape: ModelShape, frames: DataFrame[], fallbackTimeMs: number): void {
    if (!isQuaternionInterpolationActive(shape)) {
      this.entries.delete(shape.id);
      return;
    }

    const bufferSize = Math.max(2, Math.floor(Number(shape.interpBufferSize) || 2));
    const key = [
      shape.quatX.value, shape.quatY.value, shape.quatZ.value, shape.quatW.value,
      shape.interpTimeField ?? '',
    ].join('|');
    let entry = this.entries.get(shape.id);
    if (!entry || entry.key !== key) {
      entry = { key, samples: [] };
      this.entries.set(shape.id, entry);
    }

    const incoming = collectQuaternionSamples(
      frames,
      { x: shape.quatX.value, y: shape.quatY.value, z: shape.quatZ.value, w: shape.quatW.value },
      shape.interpTimeField ?? '',
      bufferSize,
      fallbackTimeMs
    );
    if (incoming.length === 0) {return;}

    const newestIncoming = incoming[incoming.length - 1].t;
    const newestRetained = entry.samples[entry.samples.length - 1]?.t;
    if (newestRetained !== undefined && newestIncoming < newestRetained) {
      entry.samples = [...incoming];
    } else {
      entry.samples.push(...incoming.filter((sample) => newestRetained === undefined || sample.t > newestRetained));
    }
    if (entry.samples.length > bufferSize) {
      entry.samples.splice(0, entry.samples.length - bufferSize);
    }
  }

  sample(id: string, targetMs: number, maxExtrapMs: number): THREE.Quaternion | null {
    return sampleQuaternionAt(this.entries.get(id)?.samples ?? [], targetMs, maxExtrapMs);
  }

  getSamples(id: string): QuaternionSample[] {
    return this.entries.get(id)?.samples ?? [];
  }

  retain(ids: Set<string>): void {
    for (const id of this.entries.keys()) {
      if (!ids.has(id)) {this.entries.delete(id);}
    }
  }
}

export const getInterpolationTargetMs = (timeRange: TimeRange | undefined, arrivedAtMs: number, nowMs: number): number => {
  if (!timeRange) {return nowMs;}
  const rawTo = timeRange.raw?.to;
  const followsNow = typeof rawTo === 'string' && rawTo.startsWith('now');
  const rangeEnd = timeRange.to.valueOf();
  return followsNow ? rangeEnd + (nowMs - arrivedAtMs) : rangeEnd;
};
