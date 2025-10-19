import React from 'react';
import { StandardEditorProps } from '@grafana/data';
import { 
  Input, 
  VerticalGroup,
  InlineField
} from '@grafana/ui';
import { ViewAngleScalingSettings } from '../types';

interface ViewAngleScalingEditorProps extends StandardEditorProps<ViewAngleScalingSettings> {}

const defaultViewAngleScalingSettings: ViewAngleScalingSettings = {
  targetAngularSize: 0.05,
  minSize: 0.1,
  maxSize: 14720000000.0
};

const ViewAngleScalingEditor: React.FC<ViewAngleScalingEditorProps> = ({ value, onChange }) => {
  const settings = { ...defaultViewAngleScalingSettings, ...value };

  const updateSettings = (updates: Partial<ViewAngleScalingSettings>) => {
    onChange({ ...settings, ...updates });
  };

  return (
    <VerticalGroup spacing="sm">
      <InlineField 
        label="Target Angular Size" 
        labelWidth={20}
        tooltip="Target angular size in radians for auto-scaled objects"
      >
        <Input
          type="number"
          width={20}
          step="0.01"
          value={settings.targetAngularSize}
          onChange={(e) => updateSettings({ targetAngularSize: parseFloat(e.currentTarget.value) || 0.2 })}
        />
      </InlineField>
      
      <InlineField 
        label="Min Size" 
        labelWidth={20}
        tooltip="Minimum size limit for auto-scaled objects"
      >
        <Input
          type="number"
          width={20}
          step="0.1"
          value={settings.minSize}
          onChange={(e) => updateSettings({ minSize: parseFloat(e.currentTarget.value) || 0.1 })}
        />
      </InlineField>
      
      <InlineField 
        label="Max Size" 
        labelWidth={20}
        tooltip="Maximum size limit for auto-scaled objects"
      >
        <Input
          type="number"
          width={20}
          step="0.5"
          value={settings.maxSize}
          onChange={(e) => updateSettings({ maxSize: parseFloat(e.currentTarget.value) || 14720000000.0 })}
        />
      </InlineField>
    </VerticalGroup>
  );
};

export default ViewAngleScalingEditor;
