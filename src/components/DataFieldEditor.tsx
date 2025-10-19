import React from 'react';
import { Field, Input, RadioButtonGroup, Select } from '@grafana/ui';
import { DataField } from '../types';
import { PanelData } from '@grafana/data';
import { getFieldOptions } from './utils/CommonHelpers';

interface DataFieldEditorProps {
  label: string;
  value: DataField;
  onChange: (value: DataField) => void;
  placeholder?: string;
  data?: PanelData;
}

export const DataFieldEditor: React.FC<DataFieldEditorProps> = ({
  label,
  value,
  onChange,
  placeholder = '',
  data,
}) => {
  const sourceTypeOptions = [
    { label: 'Const', value: 'const' as const },
    { label: 'Field', value: 'field' as const },
  ];

  const fieldOptions = getFieldOptions(data);

  const handleSourceTypeChange = (sourceType: 'const' | 'field') => {
    onChange({
      ...value,
      sourceType,
      value: '', // Reset value when changing source type
    });
  };

  const handleValueChange = (newValue: string) => {
    onChange({
      ...value,
      value: newValue,
    });
  };

  const handleFieldSelect = (option: any) => {
    if (option && option.value) {
      handleValueChange(option.value);
    }
  };

  return (
    <div>
      <Field label={label}>
        <RadioButtonGroup
          options={sourceTypeOptions}
          value={value.sourceType}
          onChange={handleSourceTypeChange}
        />
      </Field>
      
      <Field label={`${label} Value`}>
        {value.sourceType === 'field' && fieldOptions.length > 0 ? (
          <Select
            options={fieldOptions}
            value={fieldOptions.find(option => option.value === value.value)}
            onChange={handleFieldSelect}
            placeholder="Select data field"
            isClearable
            allowCustomValue
            onCreateOption={(inputValue) => {
              handleValueChange(inputValue);
            }}
          />
        ) : (
          <Input
            value={value.value}
            onChange={(e) => handleValueChange(e.currentTarget.value)}
            placeholder={
              value.sourceType === 'const' 
                ? placeholder || 'Enter constant value' 
                : fieldOptions.length === 0
                  ? 'No data fields available or enter field name manually'
                  : 'Select data field name'
            }
          />
        )}
      </Field>
      
      {value.sourceType === 'field' && fieldOptions.length > 0 && (
        <Field label="Field format">
          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
            <div>Use "dataSourceName.fieldName" format for specific data source, or just "fieldName" for all data sources.</div>
          </div>
        </Field>
      )}
    </div>
  );
};
