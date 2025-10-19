import React from 'react';
import { Field, Input, useStyles2 } from '@grafana/ui';
import { AxisSettings, AxisConfig } from '../types';
import { StandardEditorProps } from '@grafana/data';
import { getCommonStyles } from './utils/CommonHelpers';

interface AxisEditorProps extends StandardEditorProps<AxisSettings> {}

const getStyles = getCommonStyles;

export const AxisEditor: React.FC<AxisEditorProps> = ({ value, onChange }) => {
  const styles = useStyles2(getStyles);
  
  // Default axis settings
  const defaultAxisSettings: AxisSettings = {
    x: {
      displayMode: 'all',
    },
    y: {
      displayMode: 'all',
    },
    z: {
      displayMode: 'all',
    },
  };

  // Use provided value or defaults
  const axisSettings = value || defaultAxisSettings;

  const updateAxis = (axis: 'x' | 'y' | 'z', config: Partial<AxisConfig>) => {
    onChange({
      ...axisSettings,
      [axis]: {
        ...axisSettings[axis],
        ...config,
      },
    });
  };

  const renderAxisEditor = (axis: 'x' | 'y' | 'z', label: string) => {
    const axisConfig = axisSettings[axis];

    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{label} Axis</div>
        
        <div className={styles.controlRow}>
          <Field className={styles.control} label="Min Value">
            <Input
              type="number"
              placeholder="Auto"
              value={axisConfig.min !== undefined ? axisConfig.min : ''}
              onChange={(e) => {
                const value = e.currentTarget.value;
                updateAxis(axis, {
                  min: value === '' ? undefined : parseFloat(value),
                });
              }}
            />
          </Field>
          
          <Field className={styles.control} label="Max Value">
            <Input
              type="number"
              placeholder="Auto"
              value={axisConfig.max !== undefined ? axisConfig.max : ''}
              onChange={(e) => {
                const value = e.currentTarget.value;
                updateAxis(axis, {
                  max: value === '' ? undefined : parseFloat(value),
                });
              }}
            />
          </Field>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {renderAxisEditor('x', 'X')}
      {renderAxisEditor('y', 'Y')}
      {renderAxisEditor('z', 'Z')}
    </div>
  );
};
