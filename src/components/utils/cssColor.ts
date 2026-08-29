import { ColorTable } from './colorTable';

const toRgba = (hex6: string, opacity: number): string => {
  const r = parseInt(hex6.slice(0, 2), 16);
  const g = parseInt(hex6.slice(2, 4), 16);
  const b = parseInt(hex6.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Resolve a Grafana color option value (hex '#rrggbb'/'#rrggbbaa', an 'rgb()'/'rgba()'
// string, a named theme color from ColorTable, or 'transparent') plus an independent 0-1
// opacity into a single CSS color string. Named/hex colors carry no alpha of their own here
// — opacity is applied uniformly on top — except 'transparent', which always stays fully
// transparent regardless of the opacity setting.
export const toCssColor = (color: string, opacity: number): string => {
  const op = Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1;

  if (color === 'transparent') {
    return 'rgba(0, 0, 0, 0)';
  }

  const hex6 = color.match(/^#([0-9a-fA-F]{6})$/);
  if (hex6) {
    return toRgba(hex6[1], op);
  }

  const hex8 = color.match(/^#([0-9a-fA-F]{8})$/);
  if (hex8) {
    return toRgba(hex8[1].slice(0, 6), op);
  }

  const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${op})`;
  }

  if (ColorTable[color]) {
    const named = ColorTable[color].match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (named) {
      return `rgba(${named[1]}, ${named[2]}, ${named[3]}, ${op})`;
    }
  }

  return color;
};
