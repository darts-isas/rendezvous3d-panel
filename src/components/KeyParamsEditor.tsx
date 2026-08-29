import React, { useState } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { Button, Combobox, Field, IconButton, InlineField, Input, Stack } from '@grafana/ui';
import { KeyParam } from '../types';
import { getAllFieldOptions } from './utils/dataFields';

interface KeyParamsEditorProps extends StandardEditorProps<KeyParam[]> {}

const createKeyParam = (id: string, name: string): KeyParam => ({
  id,
  name,
  visible: true,
  field: '',
  format: '%.2f',
});

const KeyParamsEditor: React.FC<KeyParamsEditorProps> = ({ value = [], onChange, context }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(value.length > 0 ? 0 : null);

  const updateItem = (index: number, patch: Partial<KeyParam>) => {
    const next = [...value];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const addItem = () => {
    const newItem = createKeyParam(Date.now().toString(), `Param ${value.length + 1}`);
    const next = [...value, newItem];
    onChange(next);
    setSelectedIndex(next.length - 1);
  };

  const deleteItem = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next);

    if (selectedIndex === index) {
      if (next.length === 0) {
        setSelectedIndex(null);
      } else if (index >= next.length) {
        setSelectedIndex(next.length - 1);
      } else {
        setSelectedIndex(index);
      }
    } else if (selectedIndex !== null && selectedIndex > index) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.length) {
      return;
    }
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    if (selectedIndex === index) {
      setSelectedIndex(target);
    } else if (selectedIndex === target) {
      setSelectedIndex(index);
    }
  };

  const fieldOptions = getAllFieldOptions(context.data ?? []);
  const selected = selectedIndex !== null ? value[selectedIndex] : undefined;

  return (
    <div style={{ padding: '10px' }}>
      <Stack direction="column" gap={2}>
        <div>
          <Button onClick={addItem} icon="plus">
            Add Key Parameter
          </Button>
          <div style={{ marginTop: '5px', fontSize: '12px', opacity: 0.7 }}>Parameters: {value.length}</div>
        </div>

        {value.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', opacity: 0.7, fontStyle: 'italic' }}>
            No key parameters added yet. Click &quot;Add Key Parameter&quot; to show a data value over the model.
          </div>
        ) : (
          <Stack direction="column" gap={2}>
            <div>
              <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>Parameter List</div>
              <div style={{ border: '1px solid #444', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                {value.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '8px 12px',
                      borderBottom: index < value.length - 1 ? '1px solid #444' : 'none',
                      backgroundColor: selectedIndex === index ? 'rgba(50, 116, 217, 0.2)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <span style={{ fontWeight: selectedIndex === index ? 'bold' : 'normal' }}>
                      {item.name || `Param ${index + 1}`}
                    </span>
                    <Stack direction="row" gap={1}>
                      <IconButton
                        name={item.visible ? 'eye' : 'eye-slash'}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateItem(index, { visible: !item.visible });
                        }}
                        tooltip={item.visible ? 'Hide parameter' : 'Show parameter'}
                      />
                      <IconButton
                        name="arrow-up"
                        size="sm"
                        disabled={index === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveItem(index, -1);
                        }}
                        tooltip="Move up"
                      />
                      <IconButton
                        name="arrow-down"
                        size="sm"
                        disabled={index === value.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveItem(index, 1);
                        }}
                        tooltip="Move down"
                      />
                      <IconButton
                        name="trash-alt"
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem(index);
                        }}
                        tooltip="Delete parameter"
                      />
                    </Stack>
                  </div>
                ))}
              </div>
            </div>

            {selected && selectedIndex !== null && (
              <div
                style={{
                  padding: '16px',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                }}
              >
                <div style={{ marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #444' }}>
                  <InlineField label="Name" labelWidth={16}>
                    <Input value={selected.name} onChange={(e) => updateItem(selectedIndex, { name: e.currentTarget.value })} />
                  </InlineField>
                </div>

                <Field
                  label="Data Field"
                  description="Series.Field or a bare field name. When more than one query returns a field of the same name, use the Series.Field form to disambiguate."
                >
                  <Combobox
                    options={fieldOptions}
                    value={fieldOptions.find((o) => o.value === selected.field) ?? null}
                    onChange={(option) => updateItem(selectedIndex, { field: option?.value ?? '' })}
                    placeholder="Select field"
                    isClearable
                    createCustomValue
                  />
                </Field>

                <Field
                  label="Format"
                  description="A single printf-style specifier (%.2f, %s, %d, %+.1e, ...), plus any literal text. Only the first specifier is substituted with the value."
                >
                  <Input
                    value={selected.format}
                    placeholder="%.2f"
                    onChange={(e) => updateItem(selectedIndex, { format: e.currentTarget.value })}
                  />
                </Field>
              </div>
            )}
          </Stack>
        )}
      </Stack>
    </div>
  );
};

export { KeyParamsEditor };
