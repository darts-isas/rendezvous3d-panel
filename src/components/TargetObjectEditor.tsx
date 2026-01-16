import React from 'react';
import { Combobox } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';
import { Rendezvous3DPanelOptions } from '../types';

interface TargetObjectEditorProps extends StandardEditorProps<string, any, Rendezvous3DPanelOptions> {}

export const TargetObjectEditor: React.FC<TargetObjectEditorProps> = ({ value, onChange, context }) => {
  // オプションリストを構築
  const options: Array<{ label: string; value: string }> = [
    { value: 'origin', label: 'Origin (0,0,0)' }
  ];

  // オブジェクトが設定されている場合、それらをオプションに追加
  if (context.options?.objects) {
    context.options.objects.forEach((obj) => {
      if (obj.name && obj.id) {
        options.push({ 
          value: obj.id, 
          label: obj.name 
        });
      }
    });
  }

  // 現在の値が有効でない場合は'origin'にフォールバック
  const currentValue = value || 'origin';
  
  // 現在の値に対応するオプションを見つける
  const selectedOption = options.find(option => option.value === currentValue) || (options.length > 0 ? options[0] : undefined);

  return (
    <Combobox
      value={selectedOption}
      options={options}
      onChange={(selectedOption) => {
        const newValue = selectedOption?.value || 'origin';
        onChange(newValue);
      }}
      placeholder="Select target object"
      isClearable={false}
    />
  );
};
