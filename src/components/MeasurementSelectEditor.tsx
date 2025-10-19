import React, { useEffect, useState } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { Select } from '@grafana/ui';

interface MeasurementSelectEditorProps extends StandardEditorProps<string> {
  context: any;
}

// Helper function to extract measurement name from series name
const extractMeasurementName = (seriesName: string | null | undefined): string => {
  if (!seriesName) return '';
  
  try {
    const parts = seriesName.split(',');
    return parts[0] || '';
  } catch (error) {
    console.warn('Measurement name extraction failed:', error);
    return '';
  }
};

export const MeasurementSelectEditor = ({ value, context, onChange, item }: MeasurementSelectEditorProps) => {
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([]);

  useEffect(() => {
    // データソースからMeasurement名を取得
    const measurementOptions: Array<{ label: string; value: string }> = [];
    const measurementSet = new Set<string>(); // 重複を避けるためのセット
    const defaultValue = item.settings?.defaultValue || '';
    
    const dataArray = Array.isArray(context.data) ? context.data : 
                      (context.data?.series || context.data?.state?.data || []);
    
    // データフレームがある場合
    if (dataArray && dataArray.length > 0) {
      try {
        dataArray.forEach((series: any, index: number) => {
          try {
            if (series && series.name) {
              const measurementName = extractMeasurementName(series.name);
              if (measurementName && !measurementSet.has(measurementName)) {
                measurementSet.add(measurementName);
                measurementOptions.push({ label: measurementName, value: measurementName });
              }
            } else if (series.refId) {
              if (!measurementSet.has(series.refId)) {
                measurementSet.add(series.refId);
                measurementOptions.push({ label: series.refId, value: series.refId });
              }
            }
          } catch (err) {
            // 個別のシリーズ処理でエラーが発生した場合はスキップして続行
            console.warn('Error processing measurement series:', err);
          }
        });
      } catch (error) {
        console.warn('Error processing measurement data series:', error);
      }
    }
    
    // 少なくとも一つのデフォルトオプション（空の測定名）を追加
    if (measurementOptions.length === 0) {
      if (defaultValue) {
        measurementOptions.push({ label: defaultValue, value: defaultValue });
      } else {
        measurementOptions.push({ label: '-- choose Measurement Name --', value: '' });
      }
    }
    
    // 値が既に選択されていて、オプションにない場合は追加
    if (value && value !== '' && !measurementOptions.some(option => option.value === value)) {
      measurementOptions.push({ label: value, value: value });
    }
    
    setOptions(measurementOptions);
  }, [context, item.settings?.defaultValue, value]);

  return (
    <Select
      options={options}
      value={options.find(option => option.value === value) || null}
      onChange={(selectedOption) => {
        onChange(selectedOption?.value || '');
      }}
      allowCustomValue
      placeholder="Measurement Name"
      onCreateOption={(customValue) => {
        // カスタム値が有効な場合のみ追加
        if (customValue && customValue.trim() !== '') {
          const newOption = { label: customValue, value: customValue };
          setOptions([...options, newOption]);
          onChange(customValue);
        } else {
          onChange('');
        }
      }}
      isClearable
      invalid={false} 
      noOptionsMessage={ "No measurements found" }
    />
  );
};
