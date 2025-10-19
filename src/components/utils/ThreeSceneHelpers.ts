import * as THREE from 'three';
import { Shape } from '../../types';
import { PanelData } from '@grafana/data';

export class DataFieldProcessor {
  public data?: PanelData;

  constructor(data?: PanelData) {
    this.data = data;
  }

  // データが新しく設定された際の処理
  setData(newData?: PanelData): void {
    this.data = newData;
  }

  // Helper function to get value from DataField as strings (for annotations)
  getFieldValueAsString(field: any, defaultValue = ''): string[] {
    if (!field) {
      return [defaultValue];
    }
    
    if (field.sourceType === 'const') {
      const value = field.value || '';
      if (value.includes(',')) {
        const result = value.split(',').map((v: string) => v.trim());
        return result;
      }
      const result = [value];
      return result;
    }
    
    if (field.sourceType === 'field' && this.data?.series) {
      return this.getFieldFromDataSourceAsString(field, defaultValue);
    }
    
    return [defaultValue];
  }

  // Helper function to get value from DataField
  getDataFieldValue(field: any, defaultValue = 0): number[] {
    if (!field) {
      return [defaultValue];
    }
    
    
    if (field.sourceType === 'const') {
      const value = field.value || '0';
      // Convert to string if it's not already a string
      const valueStr = typeof value === 'string' ? value : String(value);
      if (valueStr.includes(',')) {
        const result = valueStr.split(',').map((v: string) => {
          const parsed = parseFloat(v.trim());
          return isFinite(parsed) ? parsed : 0;
        });
        return result;
      }
      const parsed = parseFloat(valueStr);
      const result = [isFinite(parsed) ? parsed : defaultValue];
      return result;
    }
    
    if (field.sourceType === 'field' && this.data?.series) {
      return this.getFieldFromDataSource(field, defaultValue);
    }
    
    return [defaultValue];
  }

  private getFieldFromDataSource(field: any, defaultValue: number): number[] {
    if (!this.data?.series) {
      return [defaultValue];
    }
    
    // Parse field value format: [DataSourceName]{FieldName} or DataSourceName.FieldName or just FieldName
    let targetSeriesName: string | null = null;
    let targetFieldName: string = field.value;
    
    // Check for [DataSourceName]{FieldName} format
    const bracketMatch = field.value.match(/^\[([^\]]+)\]\{([^}]+)\}$/);
    if (bracketMatch) {
      targetSeriesName = bracketMatch[1];
      targetFieldName = bracketMatch[2];
    } else {
      // Check for DataSourceName.FieldName format
      const dotMatch = field.value.match(/^([^.]+)\.(.+)$/);
      if (dotMatch) {
        targetSeriesName = dotMatch[1];
        targetFieldName = dotMatch[2];
      }
    }
    
    // First, try to find by series name + field name combination if series name is specified
    if (targetSeriesName) {
      const result = this.findFieldBySeriesAndName(targetSeriesName, targetFieldName);
      if (result) {
        return result;
      }
    }
    
    // Fallback: search all series for the field name
    return this.findFieldByName(targetFieldName, defaultValue);
  }

  private findFieldBySeriesAndName(targetSeriesName: string, targetFieldName: string): number[] | null {
    for (let i = 0; i < this.data!.series.length; i++) {
      const series = this.data!.series[i];
      
      if (series.name === targetSeriesName || series.refId === targetSeriesName) {
        const fieldData = series.fields.find(f => f.name === targetFieldName);
        if (fieldData && fieldData.values.length > 0) {
          return this.processFieldValues(fieldData);
        }
      }
    }
    return null;
  }

  private findFieldByName(targetFieldName: string, defaultValue: number): number[] {
    for (let i = 0; i < this.data!.series.length; i++) {
      const series = this.data!.series[i];
      const fieldData = series.fields.find(f => f.name === targetFieldName);
      if (fieldData && fieldData.values.length > 0) {
        return this.processFieldValues(fieldData);
      }
    }
    
    return [defaultValue];
  }

  private processFieldValues(fieldData: any): number[] {
    const rawValues = fieldData.values.toArray();
    
    return rawValues.map((v: any) => {
      if (typeof v === 'number') {
        return v;
      }
      if (typeof v === 'string') {
        const parsed = parseFloat(v);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    });
  }

  private getFieldFromDataSourceAsString(field: any, defaultValue: string): string[] {
    if (!this.data?.series) {
      return [defaultValue];
    }
    
    // Parse field value format: [DataSourceName]{FieldName} or DataSourceName.FieldName or just FieldName
    let targetSeriesName: string | null = null;
    let targetFieldName: string = field.value;
    
    // Check for [DataSourceName]{FieldName} format
    const bracketMatch = field.value.match(/^\[([^\]]+)\]\{([^}]+)\}$/);
    if (bracketMatch) {
      targetSeriesName = bracketMatch[1];
      targetFieldName = bracketMatch[2];
    } else {
      // Check for DataSourceName.FieldName format
      const dotMatch = field.value.match(/^([^.]+)\.(.+)$/);
      if (dotMatch) {
        targetSeriesName = dotMatch[1];
        targetFieldName = dotMatch[2];
      }
    }
    
    // First, try to find by series name + field name combination if series name is specified
    if (targetSeriesName) {
      const result = this.findFieldBySeriesAndNameAsString(targetSeriesName, targetFieldName);
      if (result) {
        return result;
      }
    }
    
    // Fallback: search all series for the field name
    return this.findFieldByNameAsString(targetFieldName, defaultValue);
  }

  private findFieldBySeriesAndNameAsString(targetSeriesName: string, targetFieldName: string): string[] | null {
    for (let i = 0; i < this.data!.series.length; i++) {
      const series = this.data!.series[i];
      
      if (series.name === targetSeriesName || series.refId === targetSeriesName) {
        const fieldData = series.fields.find(f => f.name === targetFieldName);
        if (fieldData && fieldData.values.length > 0) {
          return this.processFieldValuesAsString(fieldData);
        }
      }
    }
    return null;
  }

  private findFieldByNameAsString(targetFieldName: string, defaultValue: string): string[] {
    for (let i = 0; i < this.data!.series.length; i++) {
      const series = this.data!.series[i];
      const fieldData = series.fields.find(f => f.name === targetFieldName);
      if (fieldData && fieldData.values.length > 0) {
        return this.processFieldValuesAsString(fieldData);
      }
    }
    
    return [defaultValue];
  }

  private processFieldValuesAsString(fieldData: any): string[] {
    const rawValues = fieldData.values.toArray();
    
    return rawValues.map((v: any) => {
      return String(v);
    });
  }

  // Get last value from DataField
  getLastDataFieldValue(field: any, defaultValue = 0): number {
    try {
      const values = this.getDataFieldValue(field, defaultValue);
      const lastValue = values[values.length - 1];
      
      // Ensure the value is finite and valid
      if (!isFinite(lastValue)) {
        console.warn(`Invalid value from field ${field?.value || 'unknown'}:`, lastValue, 'using default:', defaultValue);
        return defaultValue;
      }
      
      return lastValue;
    } catch (error) {
      console.error('Error getting last data field value:', error, 'field:', field);
      return defaultValue;
    }
  }

  // Helper function to get string values from DataField
  getTextDataFieldValue(field: any, defaultValue = ''): string[] {
    if (!field) {
      return [defaultValue];
    }
    
    if (field.sourceType === 'const') {
      const value = field.value || '';
      // Convert to string if it's not already a string
      const valueStr = typeof value === 'string' ? value : String(value);
      if (valueStr.includes(',')) {
        const result = valueStr.split(',').map((v: string) => v.trim());
        return result;
      }
      const result = [valueStr];
      return result;
    }
    
    if (field.sourceType === 'field' && this.data?.series) {
      return this.getTextFieldFromDataSource(field, defaultValue);
    }
    
    return [defaultValue];
  }

  private getTextFieldFromDataSource(field: any, defaultValue: string): string[] {
    if (!this.data?.series) return [defaultValue];
    
    // Parse field value format: [DataSourceName]{FieldName} or DataSourceName.FieldName or just FieldName
    let targetSeriesName: string | null = null;
    let targetFieldName: string = field.value;
    
    // Handle [DataSourceName]{FieldName} format
    const bracketMatch = field.value.match(/^\[([^\]]+)\]\{([^}]+)\}$/);
    if (bracketMatch) {
      targetSeriesName = bracketMatch[1];
      targetFieldName = bracketMatch[2];
    } else {
      // Handle DataSourceName.FieldName format
      const dotIndex = field.value.indexOf('.');
      if (dotIndex > 0) {
        targetSeriesName = field.value.substring(0, dotIndex);
        targetFieldName = field.value.substring(dotIndex + 1);
      }
    }

    for (const series of this.data.series) {
      // If we have a target series name, check if it matches
      if (targetSeriesName && series.name !== targetSeriesName) {
        continue;
      }
      
      // Look for the field in this series
      const targetField = series.fields.find(f => f.name === targetFieldName);
      if (targetField && targetField.values) {
        // Convert all values to strings
        const rawValues = targetField.values.toArray();
        const result = rawValues.map((val) => {
          return String(val);
        });
        return result;
      }
    }
    
    return [defaultValue];
  }

  // Get last text value from DataField
  getLastTextDataFieldValue(field: any, defaultValue = ''): string {
    const values = this.getFieldValueAsString(field, defaultValue);
    return values[values.length - 1] || defaultValue;
  }
}

export class BoundsCalculator {
  private dataProcessor: DataFieldProcessor;

  constructor(dataProcessor: DataFieldProcessor) {
    this.dataProcessor = dataProcessor;
  }

  // Calculate auto scale limits based on data
  calculateAutoScaleLimits(objects: Shape[]) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    // Get bounds from objects
    objects.forEach(shape => {
      if (!shape.visible) {
        return;
      }

      try {
        if (shape.type === 'sphere' || shape.type === 'annotation' || shape.type === '3dmodel') {
          const posX = this.dataProcessor.getLastDataFieldValue(shape.posX, 0);
          const posY = this.dataProcessor.getLastDataFieldValue(shape.posY, 0);
          const posZ = this.dataProcessor.getLastDataFieldValue(shape.posZ, 0);
          
          minX = Math.min(minX, posX);
          maxX = Math.max(maxX, posX);
          minY = Math.min(minY, posY);
          maxY = Math.max(maxY, posY);
          minZ = Math.min(minZ, posZ);
          maxZ = Math.max(maxZ, posZ);
        } else if (shape.type === 'polyline') {
          const pointsX = this.dataProcessor.getDataFieldValue(shape.pointsX, 0);
          const pointsY = this.dataProcessor.getDataFieldValue(shape.pointsY, 0);
          const pointsZ = this.dataProcessor.getDataFieldValue(shape.pointsZ, 0);
          
          pointsX.forEach(x => {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
          });
          pointsY.forEach(y => {
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          });
          pointsZ.forEach(z => {
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
          });
        }
      } catch (error) {
        console.warn('Error calculating bounds for object:', shape.name, error);
      }
    });

    // Add padding if we found valid bounds
    if (isFinite(minX) && isFinite(maxX)) {
      const rangeX = maxX - minX || 10;
      const padding = rangeX * 0.1;
      minX -= padding;
      maxX += padding;
    } else {
      minX = -50;
      maxX = 50;
    }

    if (isFinite(minY) && isFinite(maxY)) {
      const rangeY = maxY - minY || 10;
      const padding = rangeY * 0.1;
      minY -= padding;
      maxY += padding;
    } else {
      minY = -50;
      maxY = 50;
    }

    if (isFinite(minZ) && isFinite(maxZ)) {
      const rangeZ = maxZ - minZ || 10;
      const padding = rangeZ * 0.1;
      minZ -= padding;
      maxZ += padding;
    } else {
      minZ = -50;
      maxZ = 50;
    }

    return { minX, maxX, minY, maxY, minZ, maxZ };
  }
}

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private controls: any; // OrbitControls
  private objectsRef: React.MutableRefObject<Map<string, THREE.Object3D>>;
  private dataProcessor: DataFieldProcessor;

  constructor(
    camera: THREE.PerspectiveCamera, 
    controls: any, 
    boundsCalculator: BoundsCalculator,
    objectsRef: React.MutableRefObject<Map<string, THREE.Object3D>>,
    dataProcessor: DataFieldProcessor
  ) {
    this.camera = camera;
    this.controls = controls;
    this.objectsRef = objectsRef;
    this.dataProcessor = dataProcessor;
  }

  updateCameraPosition(targetObjectId: string, objects: Shape[], axis?: string, direction?: string, cameraSettings?: any) {
    if (!this.camera || !this.controls) return;

    // Use direct X, Y, Z coordinates
    this.setDirectCameraPosition(cameraSettings, targetObjectId);
  }

  private setDirectCameraPosition(cameraSettings: any, targetObjectId: string) {
    // Get camera position directly from X, Y, Z coordinates
    const posX = this.dataProcessor.getLastDataFieldValue(cameraSettings?.posX, 100);
    const posY = this.dataProcessor.getLastDataFieldValue(cameraSettings?.posY, 100);
    const posZ = this.dataProcessor.getLastDataFieldValue(cameraSettings?.posZ, 100);

    // Set camera position directly (not relative to target)
    this.camera.position.set(posX, posY, posZ);

    // Determine target position for camera to look at
    let targetX = 0, targetY = 0, targetZ = 0;
    if (targetObjectId !== 'origin') {
      const targetObject = this.objectsRef.current.get(targetObjectId);
      if (targetObject) {
        targetX = targetObject.position.x;
        targetY = targetObject.position.y;
        targetZ = targetObject.position.z;
      }
    }

    this.controls.target.set(targetX, targetY, targetZ);
    this.controls.update();
  }
}
