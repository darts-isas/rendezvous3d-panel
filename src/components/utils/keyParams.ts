import { DataFrame } from '@grafana/data';
import { KeyParam } from '../../types';
import { getLastRawFieldValue, resolveField } from './dataFields';

export const DEFAULT_FORMAT = '%.2f';

// Maps the 'Separator' radio option to the literal text placed between the name and value
// columns of each line.
export const SEPARATOR_MAP: Record<'colon' | 'equal' | 'space', string> = {
  colon: ': ',
  equal: ' = ',
  space: '  ',
};

// Matches one printf-style specifier ('%%' included) inside a format string. Flags: any of
// - + space 0 #, an optional width, an optional .precision, then one conversion letter.
const SPEC_RE = /%(?:%|[-+ 0#]*\d*(?:\.\d+)?[diufeEgGs])/g;
const SPEC_PARTS_RE = /^%([-+ 0#]*)(\d*)(?:\.(\d+))?([diufeEgGs])$/;

// Renders a single printf-style specifier (e.g. '%+05.2f') against one value. Non-numeric
// or non-finite values fall back to their String() form rather than throwing or printing
// NaN, since a data field can legitimately hold a string (e.g. a mode name).
const formatSpec = (spec: string, value: unknown): string => {
  const parts = spec.match(SPEC_PARTS_RE);
  if (!parts) {
    return spec;
  }

  const [, flags, widthStr, precStr, conv] = parts;
  const width = widthStr ? parseInt(widthStr, 10) : 0;
  const prec = precStr !== undefined ? parseInt(precStr, 10) : undefined;

  let text: string;
  if (conv === 's') {
    text = String(value ?? '');
  } else {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (!Number.isFinite(num)) {
      text = String(value ?? '-');
    } else {
      switch (conv) {
        case 'd':
        case 'i':
        case 'u':
          text = Math.round(num).toString();
          break;
        case 'e':
        case 'E':
          text = num.toExponential(prec ?? 2);
          if (conv === 'E') {
            text = text.toUpperCase();
          }
          break;
        case 'g':
        case 'G':
          text = prec !== undefined ? num.toPrecision(prec) : num.toString();
          if (conv === 'G') {
            text = text.toUpperCase();
          }
          break;
        case 'f':
        default:
          text = num.toFixed(prec ?? 2);
          break;
      }
      if (flags.includes('+') && num >= 0) {
        text = '+' + text;
      }
    }
  }

  if (width > text.length) {
    const padLen = width - text.length;
    if (flags.includes('-')) {
      text = text + ' '.repeat(padLen);
    } else if (flags.includes('0') && conv !== 's' && (text.startsWith('-') || text.startsWith('+'))) {
      text = text[0] + '0'.repeat(padLen) + text.slice(1);
    } else {
      const padChar = flags.includes('0') && conv !== 's' ? '0' : ' ';
      text = padChar.repeat(padLen) + text;
    }
  }

  return text;
};

// Right-aligns text into a fixed width, truncating from the left when it overflows, so the
// value column never changes width regardless of how many digits/characters the value has.
const padToWidth = (text: string, width: number): string => {
  if (width <= 0) {
    return text;
  }
  if (text.length > width) {
    return text.slice(0, width);
  }
  return text.padStart(width, ' ');
};

// Substitutes the first printf specifier in `format` with `value`, formatted and padded to
// `valueWidth`; any other '%...' occurrences are left as literal text, and '%%' always
// renders as a literal '%'. `value === undefined` (field missing/unresolved) always renders
// as '-', regardless of the specifier's conversion type.
export const formatValue = (format: string, value: unknown, valueWidth: number): string => {
  let used = false;
  return format.replace(SPEC_RE, (match) => {
    if (match === '%%') {
      return '%';
    }
    if (used) {
      return match;
    }
    used = true;
    const text = value === undefined ? '-' : formatSpec(match, value);
    return padToWidth(text, valueWidth);
  });
};

export interface KeyParamLineOptions {
  separator: string;
  valueWidth: number;
}

// Builds one fixed-format line per visible key parameter: "<name padded><separator><value
// padded>". The name column width is the longest visible name, and the value column width
// is fixed by valueWidth — so the overlay's size depends only on the item count, the names,
// and valueWidth, never on the values themselves.
export const buildKeyParamLines = (
  items: KeyParam[],
  series: DataFrame[] | undefined | null,
  opts: KeyParamLineOptions
): string[] => {
  const visible = items.filter((item) => item.visible !== false);
  if (visible.length === 0) {
    return [];
  }

  const maxNameLen = Math.max(...visible.map((item) => (item.name ?? '').length));

  return visible.map((item) => {
    const field = resolveField(series, item.field ?? '');
    const raw = field ? getLastRawFieldValue(field) : undefined;
    const value = formatValue(item.format || DEFAULT_FORMAT, raw, opts.valueWidth);
    const name = (item.name ?? '').padEnd(maxNameLen);
    return `${name}${opts.separator}${value}`;
  });
};
