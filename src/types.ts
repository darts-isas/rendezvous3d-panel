export type ShapeType = 'sphere' | '3dmodel' | 'annotation' | 'polyline';
export type DataSourceType = 'const' | 'field';

export interface BaseShape {
  id: string;
  type: ShapeType;
  name: string;
  visible: boolean;
}

export interface DataField {
  sourceType: DataSourceType;
  value: string; // フィールド名またはConst値
}

export interface SphereShape extends BaseShape {
  type: 'sphere';
  color: string;
  posX: DataField;
  posY: DataField;
  posZ: DataField;
  autoRadius: 'on' | 'off';
  radius?: number; // autoRadius が 'off' の場合のみ使用
  autoScaleFactor?: number; // autoRadius が 'on' の場合のスケール調整値
}

export interface AnnotationShape extends BaseShape {
  type: 'annotation';
  textSize: number;
  textColor: string;
  posX: DataField;
  posY: DataField;
  posZ: DataField;
  text: DataField;
  lineDirection: 'normal' | 'inverted'; // 線の方向設定
}

export interface PolylineShape extends BaseShape {
  type: 'polyline';
  strokeSize: number;
  strokeColor: string;
  pointsX: DataField;
  pointsY: DataField;
  pointsZ: DataField;
  closePath: 'on' | 'off';
  smoothCurve: 'on' | 'off';
}

export interface ModelShape extends BaseShape {
  type: '3dmodel';
  url: string;
  posX: DataField;
  posY: DataField;
  posZ: DataField;
  quatX: DataField;
  quatY: DataField;
  quatZ: DataField;
  quatW: DataField;
  autoScale: 'on' | 'off';
  scale?: number; // autoScale が 'off' の場合のみ使用
  autoScaleFactor?: number; // autoScale が 'on' の場合のスケール調整値
  unit?: 'm' | 'km'; // モデルの単位設定（デフォルト: 'km'）
}

export type Shape = SphereShape | AnnotationShape | PolylineShape | ModelShape;

export type AxisDisplayMode = 'all' | 'axis' | 'none';

export interface AxisConfig {
  displayMode: AxisDisplayMode;
  min?: number;
  max?: number;
  // autoScaleは常にtrueとして扱うため、インターフェースから削除
}

export interface AxisSettings {
  x: AxisConfig;
  y: AxisConfig;
  z: AxisConfig;
}

export type ModelSource = 'datasource' | 'url';

export type CameraOrbitMode = 'objectCenter' | 'origin';
export type CameraAxis = 'X' | 'Y' | 'Z';
export type CameraDirection = '+' | '-';

export interface CameraSettings {
  // Camera position settings
  posX: DataField; // X座標（直接位置）
  posY: DataField; // Y座標（直接位置）
  posZ: DataField; // Z座標（直接位置）
  distance?: DataField; // カメラとターゲット間の距離（参考用、オプション）
  enableControls: 'on' | 'off'; // カメラ制御の有効/無効
  showPositionAndDistance: 'on' | 'off'; // 位置と距離表示の有効/無効
  // Axis preset trigger (used internally by CameraAxisEditor)
  axisTrigger?: any;
  // On-canvas button visibility (optional for backward compat with old JSON; default true)
  showSaveCameraButton?: boolean;
  showResetCameraButton?: boolean;
}

export type PointLightDecayMode = 'none' | 'linear' | 'inverseSquare';

export interface PointLightSettings {
  enabled: 'on' | 'off';
  intensity: number;
  decayMode: PointLightDecayMode; // three.js の PointLight.decay = 0 / 1 / 2 に対応
  posX: DataField;
  posY: DataField;
  posZ: DataField;
}

export interface ViewAngleScalingSettings {
  targetAngularSize: number; // ラジアン単位（デフォルト: 0.02）
  minSize: number; // 最小サイズ（デフォルト: 0.1）
  maxSize: number; // 最大サイズ（デフォルト: 10.0）
}

export interface Rendezvous3DPanelOptions {
  // Basic Settings
  showAxis?: 'on' | 'off';
  backgroundColor?: string;
  
  // Lighting Settings
  directionalLightIntensity?: number;
  ambientLightIntensity?: number;
  environmentMapIntensity?: number;
  pointLight?: PointLightSettings;

  // Camera Settings
  camera?: CameraSettings;
  targetObjectId?: string; // 注視対象オブジェクトID（Origin含む）
  
  // View Angle Scaling Settings
  viewAngleScaling?: ViewAngleScalingSettings;
  
  // Objects
  objects?: Shape[];
}
