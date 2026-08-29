import React from 'react';
import { DataFrame } from '@grafana/data';
import { KeyParam } from '../types';
import { buildKeyParamLines, SEPARATOR_MAP } from './utils/keyParams';
import { toCssColor } from './utils/cssColor';

interface KeyParamsOverlayProps {
  keyParams: KeyParam[];
  series: DataFrame[] | undefined;
  fontSize?: number;
  verticalPosition?: 'top' | 'bottom';
  horizontalPosition?: 'left' | 'right';
  separator?: 'colon' | 'equal' | 'space';
  valueWidth?: number;
  textColor?: string;
  background?: boolean;
  backgroundColor?: string;
  backgroundOpacity?: number;
  shape?: 'rect' | 'rounded';
  border?: boolean;
  borderColor?: string;
  // True when the Position/Distance display (top-left) or the Save/Reset Camera buttons
  // (top-right) are also shown, so this overlay can shift down and avoid overlapping them.
  // These clearances are approximate, matching the existing on-canvas overlays' sizes rather
  // than measuring them exactly.
  avoidTopLeftOverlap?: boolean;
  avoidTopRightOverlap?: boolean;
}

// Text overlay drawn on top of the 3D scene, showing a fixed-format list of key parameter
// values. Size depends only on the item count, names, and the Value Width setting — never
// on the values themselves — so the box never resizes as data changes. Styled with plain
// inline CSS (no theme), matching ThreeScene.tsx's other on-canvas overlays.
export const KeyParamsOverlay: React.FC<KeyParamsOverlayProps> = ({
  keyParams,
  series,
  fontSize,
  verticalPosition,
  horizontalPosition,
  separator,
  valueWidth,
  textColor,
  background,
  backgroundColor,
  backgroundOpacity,
  shape,
  border,
  borderColor,
  avoidTopLeftOverlap,
  avoidTopRightOverlap,
}) => {
  const items = Array.isArray(keyParams) ? keyParams : [];

  const resolvedVerticalPosition = verticalPosition ?? 'top';
  const resolvedHorizontalPosition = horizontalPosition ?? 'left';
  const resolvedFontSize = fontSize ?? 14;
  const separatorKey = separator ?? 'colon';
  const resolvedValueWidth = valueWidth ?? 8;
  const resolvedTextColor = textColor ?? '#ffffff';
  const resolvedBackground = background ?? true;
  const resolvedBackgroundColor = backgroundColor ?? '#808080';
  const resolvedBackgroundOpacity = backgroundOpacity ?? 0.25;
  const resolvedShape = shape ?? 'rounded';
  const resolvedBorder = border ?? true;
  const resolvedBorderColor = borderColor ?? '#ffffff';

  const lines = buildKeyParamLines(items, series, {
    separator: SEPARATOR_MAP[separatorKey] ?? SEPARATOR_MAP.colon,
    valueWidth: resolvedValueWidth,
  });

  if (lines.length === 0) {
    return null;
  }

  const style: React.CSSProperties = {
    position: 'absolute',
    padding: '8px 12px',
    fontFamily: 'monospace',
    fontSize: `${resolvedFontSize}px`,
    lineHeight: '1.4',
    color: resolvedTextColor,
    whiteSpace: 'pre',
    pointerEvents: 'none',
    userSelect: 'none',
    maxWidth: '100%',
    overflow: 'hidden',
    borderRadius: resolvedShape === 'rounded' ? '4px' : '0',
    zIndex: 1000,
  };

  if (resolvedVerticalPosition === 'top') {
    const collidesTopLeft = resolvedHorizontalPosition === 'left' && avoidTopLeftOverlap;
    const collidesTopRight = resolvedHorizontalPosition === 'right' && avoidTopRightOverlap;
    if (collidesTopLeft) {
      style.top = '76px'; // clears the Position/Distance display box
    } else if (collidesTopRight) {
      style.top = '50px'; // clears the Save/Reset Camera button row
    } else {
      style.top = '10px';
    }
  } else {
    style.bottom = '10px';
  }
  if (resolvedHorizontalPosition === 'left') {
    style.left = '10px';
  } else {
    style.right = '10px';
  }

  if (resolvedBackground) {
    style.backgroundColor = toCssColor(resolvedBackgroundColor, resolvedBackgroundOpacity);
  }
  if (resolvedBorder) {
    style.border = `1px solid ${toCssColor(resolvedBorderColor, 1)}`;
  }

  return <div style={style}>{lines.join('\n')}</div>;
};
