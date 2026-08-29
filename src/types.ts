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
  /** @deprecated Existing dashboards only. New spheres use View Angle Scaling without a per-object factor. */
  autoScaleFactor?: number;
  /** Brightness multiplier in 0-1, fixed or field-bound. Values outside 0-1 are clamped.
   * Undefined means unchanged (1). Darkens the diffuse color toward black; does not
   * affect opacity/transparency. */
  brightness?: DataField;
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
  /** Retain timestamped field values and interpolate/extrapolate the model attitude. */
  interpEnabled?: boolean;
  /** Qualified or bare time field name. Empty means auto-detect the frame's time field. */
  interpTimeField?: string;
  /** Maximum number of timestamped quaternion samples retained across refreshes. */
  interpBufferSize?: number;
  /** When a new sample shifts the extrapolation basis, blend into the corrected orientation
   * over this many ms instead of snapping. 0 disables blending. */
  interpCatchUpMs?: number;
  autoScale: 'on' | 'off';
  /** @deprecated Existing dashboards only. New models use their native size. */
  scale?: number;
  /** Multiplier applied on top of the automatically computed size when autoScale is 'on'. Default: 1. */
  autoScaleFactor?: number;
  unit?: 'm' | 'km'; // モデルの単位設定（デフォルト: 'km'）
  /** Brightness multiplier in 0-1, fixed or field-bound. Values outside 0-1 are clamped.
   * Undefined means unchanged (1). Darkens the diffuse color toward black; does not
   * affect opacity/transparency. */
  brightness?: DataField;
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

export interface PointLightSettings {
  enabled: 'on' | 'off';
  intensity: number;
  posX: DataField;
  posY: DataField;
  posZ: DataField;
}

export interface ViewAngleScalingSettings {
  targetAngularSize: number; // ラジアン単位（デフォルト: 0.02）
  minSize: number; // 最小サイズ（デフォルト: 0.1）
  maxSize: number; // 最大サイズ（デフォルト: 10.0）
}

/** One key parameter shown in the text overlay, drawn on top of the 3D scene. */
export interface KeyParam {
  id: string;
  name: string;
  visible: boolean;

  /** Field spec, same rules as DataField's field mode: 'Series.Field' or a bare 'Field'. */
  field: string;

  /** A single printf-style specifier (%.2f, %s, %d, %+.1e, ...) plus any literal text.
   * Only the first specifier is substituted with the value; the rest is literal. */
  format: string;
}

export interface Rendezvous3DPanelOptions {
  // Basic Settings
  showAxis?: 'on' | 'off';
  backgroundColor?: string;

  // Lighting Settings
  ambientLightIntensity?: number;
  pointLight?: PointLightSettings;

  // Camera Settings
  camera?: CameraSettings;
  targetObjectId?: string; // 注視対象オブジェクトID（Origin含む）

  // View Angle Scaling Settings
  viewAngleScaling?: ViewAngleScalingSettings;

  // Objects
  objects?: Shape[];

  // Key Parameters — a fixed-format text overlay drawn on top of the 3D view.
  keyParams?: KeyParam[];
  keyParamFontSize?: number;
  // Split into two 2-way radios (rather than one 4-way one) so the options editor doesn't
  // overflow its narrow panel width.
  keyParamVerticalPosition?: 'top' | 'bottom';
  keyParamHorizontalPosition?: 'left' | 'right';
  keyParamSeparator?: 'colon' | 'equal' | 'space';
  keyParamValueWidth?: number;
  keyParamTextColor?: string;
  keyParamBackground?: boolean;
  keyParamBackgroundColor?: string;
  keyParamBackgroundOpacity?: number;
  keyParamShape?: 'rect' | 'rounded';
  keyParamBorder?: boolean;
  keyParamBorderColor?: string;
}
