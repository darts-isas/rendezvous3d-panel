import React, { useState } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { 
  Button, 
  Input, 
  Select, 
  ColorPicker, 
  Switch,
  IconButton,
  VerticalGroup,
  HorizontalGroup,
  InlineField,
  InlineFieldRow,
  RadioButtonGroup
} from '@grafana/ui';
import { Shape, ShapeType, DataField } from '../types';
import { DataFieldEditor } from './DataFieldEditor';

interface ObjectsEditorProps extends StandardEditorProps<Shape[]> {}

const createDefaultDataField = (): DataField => ({
  sourceType: 'const',
  value: '0'
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
        autoScaleFactor: 1
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
        autoScale: 'on' as const,
        scale: 1,
        autoScaleFactor: 1,
        unit: 'km' as const // デフォルトは km
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
  const panelData = context?.data ? { series: context.data } as any : undefined;

  const renderShapeSpecificFields = (shape: Shape, index: number) => {
    const updateShape = (updatedShape: Shape) => updateObject(index, updatedShape);

    switch (shape.type) {
      case 'sphere':
        return (
          <VerticalGroup spacing="sm">
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
            {shape.autoRadius === 'on' && (
              <InlineField label="Auto Scale Factor" labelWidth={16}>
                <Input
                  type="number"
                  width={20}
                  value={shape.autoScaleFactor || 1}
                  onChange={(e) => updateShape({ ...shape, autoScaleFactor: parseFloat(e.currentTarget.value) || 1 })}
                  placeholder="1.0"
                />
              </InlineField>
            )}
            {shape.autoRadius === 'off' && (
              <InlineField label="Radius" labelWidth={16}>
                <Input
                  type="number"
                  width={20}
                  value={shape.radius}
                  onChange={(e) => updateShape({ ...shape, radius: parseFloat(e.currentTarget.value) || 1 })}
                />
              </InlineField>
            )}
          </VerticalGroup>
        );
      
      case 'annotation':
        return (
          <VerticalGroup spacing="sm">
            <InlineField label="Text Size" labelWidth={16}>
              <Input
                type="number"
                width={20}
                value={shape.textSize}
                onChange={(e) => updateShape({ ...shape, textSize: parseInt(e.currentTarget.value) || 14 })}
              />
            </InlineField>
            <InlineField label="Text Color" labelWidth={16}>
              <ColorPicker
                color={shape.textColor}
                onChange={(textColor) => updateShape({ ...shape, textColor })}
              />
            </InlineField>
            <InlineField label="Line Direction" labelWidth={16}>
              <Select
                width={20}
                value={shape.lineDirection || 'normal'}
                options={[
                  { label: 'Normal (Right-Up)', value: 'normal' },
                  { label: 'Inverted (Left-Down)', value: 'inverted' }
                ]}
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
          </VerticalGroup>
        );
      
      case 'polyline':
        return (
          <VerticalGroup spacing="sm">
            <InlineField label="Stroke Size" labelWidth={16}>
              <Input
                type="number"
                width={20}
                value={shape.strokeSize}
                onChange={(e) => updateShape({ ...shape, strokeSize: parseInt(e.currentTarget.value) || 2 })}
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
          </VerticalGroup>
        );
      
      case '3dmodel':
        // 既存のオブジェクトで unit プロパティが undefined の場合、デフォルト値を設定
        const modelShape = shape.unit === undefined ? { ...shape, unit: 'km' as const } : shape;
        if (shape.unit === undefined) {
          updateShape(modelShape);
        }
        
        return (
          <VerticalGroup spacing="sm">
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
            <InlineField label="Auto Scale" labelWidth={16}>
              <Switch
                value={modelShape.autoScale === 'on'}
                onChange={(e) => updateShape({ ...modelShape, autoScale: e.currentTarget.checked ? 'on' : 'off' })}
              />
            </InlineField>
            {modelShape.autoScale === 'on' && (
              <InlineField label="Auto Scale Factor" labelWidth={16}>
                <Input
                  type="number"
                  width={20}
                  value={modelShape.autoScaleFactor || 1}
                  onChange={(e) => updateShape({ ...modelShape, autoScaleFactor: parseFloat(e.currentTarget.value) || 1 })}
                  placeholder="1.0"
                />
              </InlineField>
            )}
            {modelShape.autoScale === 'off' && (
              <InlineField label="Scale" labelWidth={16}>
                <Input
                  type="number"
                  width={20}
                  value={modelShape.scale}
                  onChange={(e) => updateShape({ ...modelShape, scale: parseFloat(e.currentTarget.value) || 1 })}
                />
              </InlineField>
            )}
          </VerticalGroup>
        );
      
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

  const updateObject = (index: number, updatedShape: Shape) => {
    const newObjects = [...value];
    newObjects[index] = updatedShape;
    onChange(newObjects);
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
      <VerticalGroup spacing="md">
        {/* オブジェクト追加セクション */}
        <div>
          <HorizontalGroup spacing="sm" align="center">
            <Select
              width={20}
              value={selectedType}
              options={[
                { label: 'Sphere', value: 'sphere' },
                { label: 'Annotation', value: 'annotation' },
                { label: 'Polyline', value: 'polyline' },
                { label: '3D Model', value: '3dmodel' }
              ]}
              onChange={(option) => setSelectedType(option.value as ShapeType)}
            />
            <Button onClick={addObject} icon="plus">
              Add {selectedType}
            </Button>
          </HorizontalGroup>
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
            No objects added yet. Select a type and click "Add" to create your first object.
          </div>
        ) : (
          <VerticalGroup spacing="md">
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
                      borderBottom: index < value.length - 1 ? '1px solid #333' : 'none',
                      backgroundColor: selectedObjectIndex === index ? '#2a2a2a' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onClick={() => setSelectedObjectIndex(index)}
                  >
                    <HorizontalGroup justify="space-between" align="center">
                      <HorizontalGroup spacing="sm" align="center">
                        <div style={{ 
                          width: '12px', 
                          height: '12px', 
                          borderRadius: '2px',
                          backgroundColor: shape.type === 'sphere' ? shape.color : 
                                         shape.type === 'annotation' ? shape.textColor :
                                         shape.type === 'polyline' ? shape.strokeColor : '#888'
                        }} />
                        <span style={{ fontWeight: selectedObjectIndex === index ? 'bold' : 'normal' }}>
                          {shape.name}
                        </span>
                        <span style={{ 
                          fontSize: '11px', 
                          opacity: 0.6,
                          textTransform: 'capitalize'
                        }}>
                          ({shape.type})
                        </span>
                      </HorizontalGroup>
                      <HorizontalGroup spacing="xs">
                        <Switch
                          value={shape.visible}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateObject(index, { ...shape, visible: e.currentTarget.checked });
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <IconButton
                          name="trash-alt"
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteObject(index);
                          }}
                          tooltip="Delete object"
                        />
                      </HorizontalGroup>
                    </HorizontalGroup>
                  </div>
                ))}
              </div>
            </div>

            {/* 選択されたオブジェクトの設定 */}
            {selectedObjectIndex !== null && selectedObjectIndex < value.length && (
              <div>
                <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                  {value[selectedObjectIndex].name} Settings
                </div>
                <div style={{ 
                  border: '1px solid #444', 
                  borderRadius: '4px', 
                  padding: '12px',
                  backgroundColor: '#1a1a1a'
                }}>
                  <VerticalGroup spacing="sm">
                    <InlineFieldRow>
                      <InlineField label="Name" labelWidth={12}>
                        <Input
                          width={25}
                          value={value[selectedObjectIndex].name}
                          onChange={(e) => updateObject(selectedObjectIndex, { 
                            ...value[selectedObjectIndex], 
                            name: e.currentTarget.value 
                          })}
                        />
                      </InlineField>
                    </InlineFieldRow>
                    {renderShapeSpecificFields(value[selectedObjectIndex], selectedObjectIndex)}
                  </VerticalGroup>
                </div>
              </div>
            )}
          </VerticalGroup>
        )}
      </VerticalGroup>
    </div>
  );
};

export { ObjectsEditor };
