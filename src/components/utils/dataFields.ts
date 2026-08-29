import { DataFrame, Field } from '@grafana/data';

// This module is intentionally independent from ThreeSceneHelpers.ts's DataFieldProcessor
// (PanelData-based, class-based) and CommonHelpers.ts's getFieldOptions (numeric-only). It
// backs the Key Parameters overlay, which needs to read the latest value of a field of any
// type (numeric, string, time, boolean, ...) and list all such fields for the editor.

const frameLabel = (frame: DataFrame, index: number): string => {
  const label = frame.name ?? frame.refId ?? '';
  return label !== '' ? label : `Query-${index + 1}`;
};

// Try the qualified form "<label>.<fieldName>". Field names may themselves contain dots, so
// the prefix is stripped and the remainder compared against the whole field name, rather than
// splitting on the first dot.
const matchQualified = (frame: DataFrame, spec: string, label: string): Field | undefined => {
  const prefix = `${label}.`;
  if (label === '' || !spec.startsWith(prefix)) {
    return undefined;
  }
  const fieldName = spec.slice(prefix.length);
  return frame.fields.find((f) => f.name === fieldName);
};

// Resolve a field spec ("<seriesLabel>.<fieldName>" or bare "<fieldName>") within a single
// frame. Pass the frame's index when it is known, so specs picked from the editor's dropdown
// for an unnamed frame — which are labelled "Query-N" — resolve too.
export const resolveFieldInFrame = (frame: DataFrame, spec: string, index = -1): Field | undefined => {
  const qualified = matchQualified(frame, spec, frame.name ?? frame.refId ?? '');
  if (qualified) {
    return qualified;
  }

  if (index >= 0) {
    const byPosition = matchQualified(frame, spec, frameLabel(frame, index));
    if (byPosition) {
      return byPosition;
    }
  }

  return frame.fields.find((f) => f.name === spec);
};

// Resolve a field spec across all frames. Qualified matches (frame label matches the spec's
// prefix) take priority over bare matches, so that the same field name in multiple frames is
// disambiguated correctly.
export const resolveField = (series: DataFrame[] | undefined | null, spec: string): Field | undefined => {
  if (!series || spec === '') {
    return undefined;
  }

  for (let i = 0; i < series.length; i++) {
    const frame = series[i];
    const field =
      matchQualified(frame, spec, frame.name ?? frame.refId ?? '') ?? matchQualified(frame, spec, frameLabel(frame, i));
    if (field) {
      return field;
    }
  }

  for (const frame of series) {
    const field = frame.fields.find((f) => f.name === spec);
    if (field) {
      return field;
    }
  }

  return undefined;
};

// Returns the raw last value untouched — needed for string fields (e.g. a mode name), where
// coercing through Number() would discard the value.
export const getLastRawFieldValue = (field: Field): unknown => {
  const values = field.values;
  if (!values || values.length === 0) {
    return undefined;
  }

  return values[values.length - 1];
};

// Used by the Key Parameters editor's Data Field picker, where the displayed value can come
// from a field of any type — unlike CommonHelpers.ts's getFieldOptions, which is numeric-only.
export const getAllFieldOptions = (series: DataFrame[] | undefined | null): Array<{ label: string; value: string }> => {
  if (!series) {
    return [];
  }

  const options: Array<{ label: string; value: string }> = [];
  const seen = new Set<string>();

  series.forEach((frame, index) => {
    const label = frameLabel(frame, index);
    frame.fields.forEach((field) => {
      const value = `${label}.${field.name}`;
      if (seen.has(value)) {
        return;
      }
      seen.add(value);

      options.push({ value, label: `${label} → ${field.name}` });
    });
  });

  return options;
};
