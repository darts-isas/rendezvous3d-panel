import React, { useState } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { 
  Button, 
  Input, 
  Combobox, 
  ColorPicker, 
  Switch,
  IconButton,
  Stack,
  InlineField,
  RadioButtonGroup
} from '@grafana/ui';
import { Shape, ShapeType, DataField } from '../types';
import { DataFieldEditor } from './DataFieldEditor';
import { getTimeFieldOptions } from './utils/CommonHelpers';

interface ObjectsEditorProps extends StandardEditorProps<Shape[]> {}

const createDefaultDataField = (): DataField => ({
  sourceType: 'const',
  value: '0'
});

const createDefaultOpacityField = (): DataField => ({
  sourceType: 'const',
  value: '1'
});

const createNewShape = (type: ShapeType, id: string): Shape => {
  const baseShape = {
    id,
    type,
    name: `${type}_${id}`,
    visible: true
  };

  switch (type) {
    case 'sphere':
      return {
        ...baseShape,
        type: 'sphere',
        color: '#ff0000',
        posX: createDefaultDataField(),
        posY: createDefaultDataField(),
        posZ: createDefaultDataField(),
        autoRadius: 'on' as const,
        radius: 1,
        opacity: createDefaultOpacityField()
      };
    case 'annotation':
      return {
        ...baseShape,
        type: 'annotation',
        textSize: 14,
        textColor: '#ffffff',
        posX: createDefaultDataField(),
        posY: createDefaultDataField(),
        posZ: createDefaultDataField(),
        text: { sourceType: 'const', value: 'Text' },
        lineDirection: 'normal' as const
      };
    case 'polyline':
      return {
        ...baseShape,
        type: 'polyline',
        strokeSize: 2,
        strokeColor: '#00ff00',
        pointsX: createDefaultDataField(),
        pointsY: createDefaultDataField(),
        pointsZ: createDefaultDataField(),
        closePath: 'off' as const,
        smoothCurve: 'off' as const
      };
    case '3dmodel':
      return {
        ...baseShape,
        type: '3dmodel',
        url: '',
        posX: createDefaultDataField(),
        posY: createDefaultDataField(),
        posZ: createDefaultDataField(),
        quatX: createDefaultDataField(),
        quatY: createDefaultDataField(),
        quatZ: createDefaultDataField(),
        quatW: { sourceType: 'const', value: '1' },
        interpEnabled: false,
        interpTimeField: '',
        interpBufferSize: 2,
        interpCatchUpMs: 300,
        autoScale: 'on' as const,
        autoScaleFactor: 1,
        unit: 'km' as const, // デフォルトは km
        opacity: createDefaultOpacityField()
      };
    default:
      throw new Error(`Unknown shape type: ${type}`);
  }
};

const ObjectsEditor: React.FC<ObjectsEditorProps> = ({ value = [], onChange, context }) => {
  const [selectedType, setSelectedType] = useState<ShapeType>('sphere');
  const [selectedObjectIndex, setSelectedObjectIndex] = useState<number | null>(
    value.length > 0 ? 0 : null
  );

  // contextからPanelDataを取得（DataFieldEditorで使用）
  // context.data は DataFrame[] 型なので、PanelData 型に合わせるために変換
  const panelData = context?.data ? { 
    series: context.data,
    state: 'Done',
    timeRange: (context as any).timeRange || {} as any
  } as any : undefined;

  const updateObject = (index: number, updatedShape: Shape) => {
    const newObjects = [...value];
    newObjects[index] = updatedShape;
    onChange(newObjects);
  };

  const renderShapeSpecificFields = (shape: Shape, index: number) => {
    const updateShape = (updatedShape: Shape) => updateObject(index, updatedShape);

    switch (shape.type) {
      case 'sphere':
        return (
          <Stack direction="column" gap={1}>
            <InlineField label="Color" labelWidth={16}>
              <ColorPicker
                color={shape.color}
                onChange={(color) => updateShape({ ...shape, color })}
              />
            </InlineField>
            <DataFieldEditor
              label="Position X"
              value={shape.posX}
              onChange={(posX: DataField) => updateShape({ ...shape, posX })}
              data={panelData}
            />
            <DataFieldEditor
              label="Position Y"
              value={shape.posY}
              onChange={(posY: DataField) => updateShape({ ...shape, posY })}
              data={panelData}
            />
            <DataFieldEditor
              label="Position Z"
              value={shape.posZ}
              onChange={(posZ: DataField) => updateShape({ ...shape, posZ })}
              data={panelData}
            />
            <InlineField label="Auto Radius" labelWidth={16}>
              <Switch
                value={shape.autoRadius === 'on'}
                onChange={(e) => updateShape({ ...shape, autoRadius: e.currentTarget.checked ? 'on' : 'off' })}
              />
            </InlineField>
            {shape.autoRadius === 'off' && (
              <InlineField label="Radius" labelWidth={16}>
                <Input
                  type="number"
                  width={20}
                  suffix="km"
                  value={shape.radius}
                  onChange={(e) => updateShape({ ...shape, radius: parseFloat(e.currentTarget.value) || 1 })}
                />
              </InlineField>
            )}
            <DataFieldEditor
              label="Opacity"
              value={shape.opacity ?? createDefaultOpacityField()}
              onChange={(opacity: DataField) => updateShape({ ...shape, opacity })}
              data={panelData}
              placeholder="0-1 (1 = opaque)"
            />
            <div style={{ fontSize: '12px', color: '#888', marginLeft: '16px', fontStyle: 'italic' }}>
              * Values are clamped to 0-1 (below 0 becomes fully transparent, above 1 becomes fully opaque)
            </div>
          </Stack>
        );

      case 'annotation':
        return (
          <Stack direction="column" gap={1}>
            <InlineField label="Text Size" labelWidth={16}>
              <Input
                type="number"
                width={20}
                value={shape.textSize}
                onChange={(e) => updateShape({ ...shape, textSize: parseInt(e.currentTarget.value, 10) || 14 })}
              />
            </InlineField>
            <InlineField label="Text Color" labelWidth={16}>
              <ColorPicker
                color={shape.textColor}
                onChange={(textColor) => updateShape({ ...shape, textColor })}
              />
            </InlineField>
            <InlineField label="Line Direction" labelWidth={16}>
              <Combobox
                width={20}
                options={[
                  { label: 'Normal (Right-Up)', value: 'normal' },
                  { label: 'Inverted (Left-Down)', value: 'inverted' }
                ]}
                value={shape.lineDirection || 'normal'}
                onChange={(option) => updateShape({ ...shape, lineDirection: option.value as 'normal' | 'inverted' })}
              />
            </InlineField>
            <DataFieldEditor
              label="Position X"
              value={shape.posX}
              onChange={(posX: DataField) => updateShape({ ...shape, posX })}
              data={panelData}
            />
            <DataFieldEditor
              label="Position Y"
              value={shape.posY}
              onChange={(posY: DataField) => updateShape({ ...shape, posY })}
              data={panelData}
            />
            <DataFieldEditor
              label="Position Z"
              value={shape.posZ}
              onChange={(posZ: DataField) => updateShape({ ...shape, posZ })}
              data={panelData}
            />
            <DataFieldEditor
              label="Text"
              value={shape.text}
              onChange={(text: DataField) => updateShape({ ...shape, text })}
              data={panelData}
            />
          </Stack>
        );
      
      case 'polyline':
        return (
          <Stack direction="column" gap={1}>
            <InlineField label="Stroke Size" labelWidth={16}>
              <Input
                type="number"
                width={20}
                value={shape.strokeSize}
                onChange={(e) => updateShape({ ...shape, strokeSize: parseInt(e.currentTarget.value, 10) || 2 })}
              />
            </InlineField>
            <InlineField label="Stroke Color" labelWidth={16}>
              <ColorPicker
                color={shape.strokeColor}
                onChange={(strokeColor) => updateShape({ ...shape, strokeColor })}
              />
            </InlineField>
            <DataFieldEditor
              label="Points X"
              value={shape.pointsX}
              onChange={(pointsX: DataField) => updateShape({ ...shape, pointsX })}
              data={panelData}
            />
            <DataFieldEditor
              label="Points Y"
              value={shape.pointsY}
              onChange={(pointsY: DataField) => updateShape({ ...shape, pointsY })}
              data={panelData}
            />
            <DataFieldEditor
              label="Points Z"
              value={shape.pointsZ}
              onChange={(pointsZ: DataField) => updateShape({ ...shape, pointsZ })}
              data={panelData}
            />
            <InlineField label="Close Path" labelWidth={16}>
              <Switch
                value={shape.closePath === 'on'}
                onChange={(e) => updateShape({ ...shape, closePath: e.currentTarget.checked ? 'on' : 'off' })}
              />
            </InlineField>
            <InlineField label="Smooth Curve" labelWidth={16}>
              <Switch
                value={shape.smoothCurve === 'on'}
                onChange={(e) => updateShape({ ...shape, smoothCurve: e.currentTarget.checked ? 'on' : 'off' })}
              />
            </InlineField>
          </Stack>
        );
      
      case '3dmodel': {
        // 既存のオブジェクトで unit プロパティが undefined の場合、デフォルト値を設定
        const modelShape = shape.unit === undefined ? { ...shape, unit: 'km' as const } : shape;
        if (shape.unit === undefined) {
          // Note: This might cause a render loop if not handled carefully, but for now we'll leave it as is
          // Ideally this should be handled in a useEffect or migration script
          setTimeout(() => updateShape(modelShape), 0);
        }
        const timeFieldOptions = getTimeFieldOptions(panelData);
        
        return (
          <Stack direction="column" gap={1}>
            <InlineField label="Model URL" labelWidth={16}>
              <Input
                width={30}
                value={modelShape.url}
                placeholder="URL to 3D model file (leave empty for default cube)"
                onChange={(e) => updateShape({ ...modelShape, url: e.currentTarget.value })}
              />
            </InlineField>
            {(!modelShape.url || modelShape.url.trim() === '') && (
              <div style={{ 
                fontSize: '12px', 
                color: '#888', 
                marginTop: '4px',
                marginLeft: '16px',
                fontStyle: 'italic'
              }}>
                * When URL is not specified, a cube with edge length {((2 * Math.sqrt(3)) / 3).toFixed(3)} will be displayed
              </div>
            )}
            <InlineField label="Model Unit" labelWidth={16}>
              <div style={{ marginLeft: '8px' }}>
                <RadioButtonGroup
                  options={[
                    { label: 'Kilometers (km)', value: 'km' },
                    { label: 'Meters (m)', value: 'm' }
                  ]}
                  value={modelShape.unit || 'km'}
                  onChange={(value) => updateShape({ ...modelShape, unit: value as 'm' | 'km' })}
                  size="sm"
                />
              </div>
            </InlineField>
            <div style={{ 
              fontSize: '12px', 
              color: '#888', 
              marginTop: '4px',
              marginLeft: '16px',
              fontStyle: 'italic'
            }}>
              {modelShape.unit === 'm' 
                ? '* Model values in meters will be scaled to 1/1000'
                : '* Model values are treated as kilometers (no scaling)'
              }
            </div>
            <DataFieldEditor
              label="Position X"
              value={modelShape.posX}
              onChange={(posX: DataField) => updateShape({ ...modelShape, posX })}
              data={panelData}
            />
            <DataFieldEditor
              label="Position Y"
              value={modelShape.posY}
              onChange={(posY: DataField) => updateShape({ ...modelShape, posY })}
              data={panelData}
            />
            <DataFieldEditor
              label="Position Z"
              value={modelShape.posZ}
              onChange={(posZ: DataField) => updateShape({ ...modelShape, posZ })}
              data={panelData}
            />
            <DataFieldEditor
              label="Quaternion X"
              value={modelShape.quatX}
              onChange={(quatX: DataField) => updateShape({ ...modelShape, quatX })}
              data={panelData}
            />
            <DataFieldEditor
              label="Quaternion Y"
              value={modelShape.quatY}
              onChange={(quatY: DataField) => updateShape({ ...modelShape, quatY })}
              data={panelData}
            />
            <DataFieldEditor
              label="Quaternion Z"
              value={modelShape.quatZ}
              onChange={(quatZ: DataField) => updateShape({ ...modelShape, quatZ })}
              data={panelData}
            />
            <DataFieldEditor
              label="Quaternion W"
              value={modelShape.quatW}
              onChange={(quatW: DataField) => updateShape({ ...modelShape, quatW })}
              data={panelData}
            />
            <div style={{
              border: '1px solid #444',
              borderRadius: '4px',
              padding: '12px',
              marginTop: '8px'
            }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>Attitude Interpolation (Quaternion)</div>
              <InlineField
                label="Enable"
                labelWidth={16}
                tooltip="Keep timestamped quaternions across refreshes and slerp toward the end of the display time range."
              >
                <Switch
                  value={modelShape.interpEnabled === true}
                  onChange={(e) => updateShape({ ...modelShape, interpEnabled: e.currentTarget.checked })}
                />
              </InlineField>
              {modelShape.interpEnabled === true && (
                <>
                  <InlineField label="Time Field" labelWidth={16} tooltip="Leave empty to auto-detect the time field.">
                    <Combobox
                      width={30}
                      options={timeFieldOptions}
                      value={modelShape.interpTimeField ?? ''}
                      placeholder="Auto-detect"
                      isClearable
                      createCustomValue
                      onChange={(option) => updateShape({ ...modelShape, interpTimeField: option?.value ?? '' })}
                    />
                  </InlineField>
                  <InlineField label="Retained Samples" labelWidth={16}>
                    <Input
                      type="number"
                      width={20}
                      min={2}
                      value={modelShape.interpBufferSize ?? 2}
                      onChange={(e) => updateShape({
                        ...modelShape,
                        interpBufferSize: Math.max(2, parseInt(e.currentTarget.value, 10) || 2),
                      })}
                    />
                  </InlineField>
                  <InlineField
                    label="Catch-up Blend [ms]"
                    labelWidth={16}
                    tooltip="When a new sample shifts the extrapolation basis, blend into the corrected orientation over this many ms instead of snapping. 0 disables blending."
                  >
                    <Input
                      type="number"
                      width={20}
                      min={0}
                      value={modelShape.interpCatchUpMs ?? 300}
                      onChange={(e) => updateShape({
                        ...modelShape,
                        interpCatchUpMs: Math.max(0, parseInt(e.currentTarget.value, 10) || 0),
                      })}
                    />
                  </InlineField>
                </>
              )}
            </div>
            <div style={{ fontWeight: 600, marginTop: '12px' }}>Scale</div>
            <InlineField label="Auto Scale" labelWidth={16}>
              <Switch
                value={modelShape.autoScale === 'on'}
                onChange={(e) => updateShape({ ...modelShape, autoScale: e.currentTarget.checked ? 'on' : 'off' })}
              />
            </InlineField>
            {modelShape.autoScale === 'on' && (
              <InlineField
                label="Auto Scale Factor"
                labelWidth={16}
                tooltip="Multiplier applied on top of the automatically computed size."
              >
                <Input
                  type="number"
                  width={20}
                  value={modelShape.autoScaleFactor ?? 1}
                  onChange={(e) => updateShape({ ...modelShape, autoScaleFactor: parseFloat(e.currentTarget.value) || 1 })}
                  placeholder="1.0"
                />
              </InlineField>
            )}
            <div style={{ fontWeight: 600, marginTop: '12px' }}>Appearance</div>
            <DataFieldEditor
              label="Opacity"
              value={modelShape.opacity ?? createDefaultOpacityField()}
              onChange={(opacity: DataField) => updateShape({ ...modelShape, opacity })}
              data={panelData}
              placeholder="0-1 (1 = opaque)"
            />
            <div style={{ fontSize: '12px', color: '#888', marginLeft: '16px', fontStyle: 'italic' }}>
              * Values are clamped to 0-1 (below 0 becomes fully transparent, above 1 becomes fully opaque)
            </div>
          </Stack>
        );
      }
      
      default:
        return null;
    }
  };

  const addObject = () => {
    const newId = Date.now().toString();
    const newShape = createNewShape(selectedType, newId);
    const newObjects = [...value, newShape];
    onChange(newObjects);
    // 新しく追加されたオブジェクトを自動選択
    setSelectedObjectIndex(newObjects.length - 1);
  };

  const deleteObject = (index: number) => {
    const newObjects = value.filter((_, i) => i !== index);
    onChange(newObjects);
    
    // 削除後の選択状態を調整
    if (selectedObjectIndex === index) {
      // 削除されたオブジェクトが選択されていた場合
      if (newObjects.length === 0) {
        setSelectedObjectIndex(null);
      } else if (index >= newObjects.length) {
        setSelectedObjectIndex(newObjects.length - 1);
      } else {
        setSelectedObjectIndex(index);
      }
    } else if (selectedObjectIndex !== null && selectedObjectIndex > index) {
      // 削除されたオブジェクトより後のオブジェクトが選択されていた場合はインデックスを調整
      setSelectedObjectIndex(selectedObjectIndex - 1);
    }
  };

  return (
    <div style={{ padding: '10px' }}>
      <Stack direction="column" gap={2}>
        {/* オブジェクト追加セクション */}
        <div>
          <Stack direction="row" gap={1} alignItems="center">
            <Combobox
              width={20}
              options={[
                { label: 'Sphere', value: 'sphere' },
                { label: 'Annotation', value: 'annotation' },
                { label: 'Polyline', value: 'polyline' },
                { label: '3D Model', value: '3dmodel' }
              ]}
              value={selectedType}
              onChange={(option) => setSelectedType(option.value as ShapeType)}
            />
            <Button onClick={addObject} icon="plus">
              Add {selectedType}
            </Button>
          </Stack>
          <div style={{ marginTop: '5px', fontSize: '12px', opacity: 0.7 }}>
            Objects: {value.length}
          </div>
        </div>

        {value.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '20px', 
            opacity: 0.7,
            fontStyle: 'italic' 
          }}>
            No objects added yet. Select a type and click &quot;Add&quot; to create your first object.
          </div>
        ) : (
          <Stack direction="column" gap={2}>
            {/* オブジェクトリスト */}
            <div>
              <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                Object List
              </div>
              <div style={{ 
                border: '1px solid #444', 
                borderRadius: '4px', 
                maxHeight: '200px', 
                overflowY: 'auto' 
              }}>
                {value.map((shape, index) => (
                  <div 
                    key={shape.id}
                    style={{
                      padding: '8px 12px',
                      borderBottom: index < value.length - 1 ? '1px solid #444' : 'none',
                      backgroundColor: selectedObjectIndex === index ? 'rgba(50, 116, 217, 0.2)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onClick={() => setSelectedObjectIndex(index)}
                  >
                    <Stack direction="row" gap={1} alignItems="center">
                      <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        borderRadius: '50%', 
                        backgroundColor: shape.type === 'sphere' ? (shape as any).color : 
                                        shape.type === 'polyline' ? (shape as any).strokeColor :
                                        shape.type === 'annotation' ? (shape as any).textColor : '#888',
                        marginRight: '8px'
                      }} />
                      <span style={{ fontWeight: selectedObjectIndex === index ? 'bold' : 'normal' }}>
                        {shape.name || `${shape.type} ${index + 1}`}
                      </span>
                      <span style={{ fontSize: '10px', color: '#888', marginLeft: '8px', textTransform: 'uppercase' }}>
                        {shape.type}
                      </span>
                    </Stack>
                    <Stack direction="row" gap={1}>
                      <IconButton
                        name={shape.visible ? 'eye' : 'eye-slash'}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateObject(index, { ...shape, visible: !shape.visible });
                        }}
                        tooltip={shape.visible ? 'Hide object' : 'Show object'}
                      />
                      <IconButton
                        name="trash-alt"
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteObject(index);
                        }}
                        tooltip="Delete object"
                      />
                    </Stack>
                  </div>
                ))}
              </div>
            </div>

            {/* 選択されたオブジェクトの編集フォーム */}
            {selectedObjectIndex !== null && value[selectedObjectIndex] && (
              <div style={{ 
                padding: '16px', 
                border: '1px solid #444', 
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)'
              }}>
                <div style={{ marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #444' }}>
                  <Stack direction="column" gap={1}>
                    <InlineField label="Name" labelWidth={16}>
                      <Input
                        value={value[selectedObjectIndex].name}
                        onChange={(e) => updateObject(selectedObjectIndex, { ...value[selectedObjectIndex], name: e.currentTarget.value })}
                      />
                    </InlineField>
                  </Stack>
                </div>
                
                {renderShapeSpecificFields(value[selectedObjectIndex], selectedObjectIndex)}
              </div>
            )}
          </Stack>
        )}
      </Stack>
    </div>
  );
};

export { ObjectsEditor };
