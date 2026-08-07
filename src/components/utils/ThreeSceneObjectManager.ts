import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { ModelShape, Shape, ViewAngleScalingSettings } from '../../types';
import { DataFieldProcessor } from './ThreeSceneHelpers';
import { ViewAngleScaling } from './ViewAngleScaling';
import { isQuaternionInterpolationActive } from './QuaternionInterpolation';

export class ThreeSceneObjectManager {
  private scene: THREE.Scene;
  private dataProcessor: DataFieldProcessor;
  private objectsRef: React.MutableRefObject<Map<string, THREE.Object3D>>;
  private gltfLoader: GLTFLoader;
  private camera: THREE.Camera | null = null;
  private globalViewAngleSettings: ViewAngleScalingSettings;
  private loadingVersions: Map<string, number> = new Map(); // 非同期処理の競合状態を防ぐ

  constructor(
    scene: THREE.Scene, 
    dataProcessor: DataFieldProcessor,
    objectsRef: React.MutableRefObject<Map<string, THREE.Object3D>>,
    globalViewAngleSettings?: ViewAngleScalingSettings
  ) {
    this.scene = scene;
    this.dataProcessor = dataProcessor;
    this.objectsRef = objectsRef;
    this.gltfLoader = new GLTFLoader();
    this.globalViewAngleSettings = globalViewAngleSettings || {
      targetAngularSize: 0.05,
      minSize: 0.1,
      maxSize: 10.0
    };
  }

  // カメラ参照を設定
  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  // グローバル視野角スケーリング設定を更新
  updateGlobalViewAngleSettings(settings: ViewAngleScalingSettings): void {
    this.globalViewAngleSettings = settings;
    
    // 既存のオブジェクトの設定も更新
    this.objectsRef.current.forEach((object) => {
      if (object.userData.viewAngleConfig) {
        object.userData.viewAngleConfig.targetAngularSize = settings.targetAngularSize;
        object.userData.viewAngleConfig.minSize = settings.minSize;
        object.userData.viewAngleConfig.maxSize = settings.maxSize;
      }
    });
  }

  private createViewAngleConfig(enabled: boolean) {
    return {
      enabled,
      targetAngularSize: this.globalViewAngleSettings.targetAngularSize,
      minSize: this.globalViewAngleSettings.minSize,
      maxSize: this.globalViewAngleSettings.maxSize
    };
  }

  private getModelUnitScale(shape: any): number {
    return shape.unit === 'm' ? 0.001 : 1.0;
  }

  private getLegacyAutoScaleFactor(shape: any): number {
    return shape.autoScaleFactor || 1.0;
  }

  private getLegacyManualScale(shape: any): number {
    return shape.scale !== undefined ? shape.scale : 1.0;
  }

  private setSphereGeometryRadius(mesh: THREE.Mesh, radius: number): void {
    if (!(mesh.geometry instanceof THREE.SphereGeometry)) {
      return;
    }

    if (mesh.geometry.parameters.radius === radius) {
      return;
    }

    const newGeometry = new THREE.SphereGeometry(radius, 32, 32);
    mesh.geometry.dispose();
    mesh.geometry = newGeometry;
  }

  // Clone each mesh's material once, right after a model is created, so brightness can be
  // applied per-shape without leaking into other meshes/models that might reference the
  // same shared material instance (common with GLTF materials reused across meshes).
  private prepareMaterialsForBrightness(root: THREE.Object3D): void {
    const cloneWithBase = (material: THREE.Material): THREE.Material => {
      const cloned = material.clone();
      const m = cloned as any;
      if (m.color instanceof THREE.Color) {
        cloned.userData.baseColor = m.color.clone();
      }
      if (m.emissive instanceof THREE.Color) {
        cloned.userData.baseEmissive = m.emissive.clone();
      }
      return cloned;
    };

    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.material) {
        return;
      }
      child.material = Array.isArray(child.material)
        ? child.material.map(cloneWithBase)
        : cloneWithBase(child.material);
    });
  }

  // Darken a shape's materials by multiplying their authored diffuse/emissive color toward
  // black. Never touches opacity/transparent/depthWrite, so the shape stays fully opaque
  // (still correctly occludes other objects) and only appears dimmer under the same lighting.
  private applyBrightness(root: THREE.Object3D, brightness: number): void {
    const applyToMaterial = (material: THREE.Material) => {
      const m = material as any;
      const baseColor: THREE.Color | undefined = material.userData?.baseColor;
      if (baseColor && m.color instanceof THREE.Color) {
        m.color.copy(baseColor).multiplyScalar(brightness);
      }
      const baseEmissive: THREE.Color | undefined = material.userData?.baseEmissive;
      if (baseEmissive && m.emissive instanceof THREE.Color) {
        m.emissive.copy(baseEmissive).multiplyScalar(brightness);
      }
    };

    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.material) {
        return;
      }
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => applyToMaterial(m));
      } else {
        applyToMaterial(child.material);
      }
    });
  }

  private applyModelSizing(model: THREE.Object3D, shape: any): void {
    const unitScale = this.getModelUnitScale(shape);
    const nativeMaxDimension = model.userData.nativeMaxDimension;
    const autoScaleFactor = this.getLegacyAutoScaleFactor(shape);

    model.userData.unitScale = unitScale;
    model.userData.originalSize = nativeMaxDimension * unitScale;
    model.userData.originalScale = autoScaleFactor * unitScale;
    model.userData.viewAngleConfig = this.createViewAngleConfig(shape.autoScale === 'on');

    const displayedScale = shape.autoScale === 'off'
      ? unitScale * this.getLegacyManualScale(shape)
      : unitScale;
    model.scale.setScalar(displayedScale);
  }

  // Create sphere object
  createSphere(shape: any): THREE.Mesh {
    const posX = this.dataProcessor.getLastDataFieldValue(shape.posX, 0);
    const posY = this.dataProcessor.getLastDataFieldValue(shape.posY, 0);
    const posZ = this.dataProcessor.getLastDataFieldValue(shape.posZ, 0);

    let radius = 1; // デフォルト値
    if (shape.autoRadius === 'off' && shape.radius !== undefined) {
      radius = shape.radius;
    }

    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshLambertMaterial({ color: shape.color || '#ff0000' });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(posX, posY, posZ);
    mesh.name = shape.name;
    this.prepareMaterialsForBrightness(mesh);
    this.applyBrightness(mesh, this.dataProcessor.getBrightnessValue(shape.brightness));
    
    mesh.userData = { 
      shapeId: shape.id, 
      shapeType: shape.type,
      originalSize: radius * 2, // 直径を元のサイズとして保存
      originalScale: this.getLegacyAutoScaleFactor(shape),
      viewAngleConfig: this.createViewAngleConfig(shape.autoRadius === 'on')
    };

    return mesh;
  }

  // Create polyline object
  createPolyline(shape: any): THREE.Line {
    const pointsX = this.dataProcessor.getDataFieldValue(shape.pointsX, 0);
    const pointsY = this.dataProcessor.getDataFieldValue(shape.pointsY, 0);
    const pointsZ = this.dataProcessor.getDataFieldValue(shape.pointsZ, 0);

    const points: THREE.Vector3[] = [];
    const minLength = Math.min(pointsX.length, pointsY.length, pointsZ.length);

    for (let i = 0; i < minLength; i++) {
      points.push(new THREE.Vector3(pointsX[i], pointsY[i], pointsZ[i]));
    }

    // Close path if requested
    if (shape.closePath === 'on' && points.length > 0) {
      points.push(points[0].clone());
    }

    let geometry: THREE.BufferGeometry;
    
    if (shape.smoothCurve === 'on' && points.length > 2) {
      // Create smooth curve
      const curve = new THREE.CatmullRomCurve3(points);
      geometry = new THREE.TubeGeometry(curve, Math.max(points.length * 2, 64), shape.strokeSize || 0.1, 8, false);
    } else {
      // Create simple line
      geometry = new THREE.BufferGeometry().setFromPoints(points);
    }

    const material = new THREE.LineBasicMaterial({ 
      color: shape.strokeColor || '#ffffff',
      linewidth: shape.strokeSize || 1
    });

    const line = new THREE.Line(geometry, material);
    line.name = shape.name;
    line.userData = { shapeId: shape.id, shapeType: shape.type };

    return line;
  }

  // Create annotation object
  createAnnotation(shape: any): THREE.Group {
    // fieldとconstの混在チェック - 位置データ
    const hasConstPos = [shape.posX, shape.posY, shape.posZ].some(field => field.sourceType === 'const');
    const hasFieldPos = [shape.posX, shape.posY, shape.posZ].some(field => field.sourceType === 'field');
    const mixedPos = hasConstPos && hasFieldPos;
    
    // fieldとconstの混在チェック - テキストデータ
    const hasFieldText = shape.text.sourceType === 'field';
    const hasConstText = shape.text.sourceType === 'const';
    const mixedWithText = (hasConstPos || hasFieldPos) && hasFieldText;
    
    // XYZがfieldで配列、textがconstantの場合の特別処理
    const allPosField = [shape.posX, shape.posY, shape.posZ].every(field => field.sourceType === 'field');
    const xyzFieldTextConst = allPosField && hasConstText;
    
    // 位置データを取得
    let posXArray, posYArray, posZArray;
    if (mixedPos) {
      // 混在の場合は最後の値のみ
      posXArray = [this.dataProcessor.getLastDataFieldValue(shape.posX, 0)];
      posYArray = [this.dataProcessor.getLastDataFieldValue(shape.posY, 0)];
      posZArray = [this.dataProcessor.getLastDataFieldValue(shape.posZ, 0)];
    } else if (xyzFieldTextConst) {
      // XYZがfield配列、textがconstantの場合は最後の位置のみ
      posXArray = [this.dataProcessor.getLastDataFieldValue(shape.posX, 0)];
      posYArray = [this.dataProcessor.getLastDataFieldValue(shape.posY, 0)];
      posZArray = [this.dataProcessor.getLastDataFieldValue(shape.posZ, 0)];
    } else {
      // 通常の処理
      posXArray = this.dataProcessor.getDataFieldValue(shape.posX, 0);
      posYArray = this.dataProcessor.getDataFieldValue(shape.posY, 0);
      posZArray = this.dataProcessor.getDataFieldValue(shape.posZ, 0);
    }
    
    // テキストデータを取得（混在の場合は最後の値のみ）
    const textArray = mixedWithText ? 
      [this.dataProcessor.getFieldValueAsString(shape.text, '')[this.dataProcessor.getFieldValueAsString(shape.text, '').length - 1] || 'Point 1'] : 
      this.dataProcessor.getFieldValueAsString(shape.text, '');

    const group = new THREE.Group();

    // 最大配列長を取得
    const maxLength = Math.max(posXArray.length, posYArray.length, posZArray.length, textArray.length);

    // 各データポイントに対してアノテーション（線+ツールチップ）を作成
    for (let i = 0; i < maxLength; i++) {
      const posX = i < posXArray.length ? posXArray[i] : (posXArray.length > 0 ? posXArray[posXArray.length - 1] : 0);
      const posY = i < posYArray.length ? posYArray[i] : (posYArray.length > 0 ? posYArray[posYArray.length - 1] : 0);
      const posZ = i < posZArray.length ? posZArray[i] : (posZArray.length > 0 ? posZArray[posZArray.length - 1] : 0);
      const text = i < textArray.length ? textArray[i] : (textArray.length > 0 ? textArray[textArray.length - 1] : `Point ${i + 1}`);

      // Skip empty text
      if (!text || text.trim() === '') {
        continue;
      }

      // アノテーションの色を決定（shape.colorまたはtextColorを使用）
      const annotationColor = shape.color || shape.textColor || '#ffffff';

      // 線の長さとオフセットを設定（元の半分に変更）
      const lineLength = 15; // 線の長さ（30から15に変更）
      const tooltipOffset = 7.5; // ツールチップの追加オフセット（15から7.5に変更）

      // 線の方向を決定（normal: 右上方向、inverted: 左下方向）
      const isInverted = shape.lineDirection === 'inverted';
      const directionMultiplier = isInverted ? -1 : 1;

      // 線の作成（方向に応じて座標を計算）
      const lineGeometry = new THREE.BufferGeometry();
      const linePositions = new Float32Array([
        posX, posY, posZ, // 開始点（指定位置）
        posX + (lineLength * 0.7 * directionMultiplier), posY + (lineLength * 0.7 * directionMultiplier), posZ, // 中間点
        posX + ((lineLength + tooltipOffset) * directionMultiplier), posY + (lineLength * 0.7 * directionMultiplier), posZ // 終点（ツールチップ位置）
      ]);
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
      
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: annotationColor,
        linewidth: 2,
        transparent: true,
        opacity: 0.8
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.userData = { 
        annotationIndex: i,
        baseLineLength: lineLength,
        tooltipOffset: tooltipOffset
      };
      group.add(line);

      // ツールチップの作成
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = 256;
      canvas.height = 64;

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Measure text to calculate tooltip size
      context.font = `${shape.textSize || 14}px Arial`;
      const textMetrics = context.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = shape.textSize || 14;
      
      // Calculate tooltip dimensions with padding
      const padding = 8;
      const tooltipWidth = textWidth + padding * 2;
      const tooltipHeight = textHeight + padding * 2;
      const cornerRadius = 4;
      
      // Center the tooltip on canvas
      const tooltipX = (canvas.width - tooltipWidth) / 2;
      const tooltipY = (canvas.height - tooltipHeight) / 2;
      
      // Draw shadow
      context.shadowColor = 'rgba(0, 0, 0, 0.3)';
      context.shadowBlur = 4;
      context.shadowOffsetX = 2;
      context.shadowOffsetY = 2;
      
      // Draw tooltip background with rounded corners using annotation color
      const rgbColor = this.hexToRgb(annotationColor);
      context.fillStyle = `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.9)`; // 透明度付きの指定色
      context.strokeStyle = annotationColor; // 同じ色でボーダー
      context.lineWidth = 2;
      
      this.drawRoundedRect(context, tooltipX, tooltipY, tooltipWidth, tooltipHeight, cornerRadius);
      context.fill();
      
      // Reset shadow for border
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
      
      // Draw border
      this.drawRoundedRect(context, tooltipX, tooltipY, tooltipWidth, tooltipHeight, cornerRadius);
      context.stroke();
      
      // Draw text - 背景が濃い場合は白、明るい場合は黒
      const textColor = this.getContrastColor(annotationColor);
      context.fillStyle = textColor;
      context.font = `${shape.textSize || 14}px Arial`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, canvas.width / 2, canvas.height / 2);
      
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ 
        map: texture,
        alphaTest: 0.01,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      
      // 距離に基づくスケーリングを計算（カメラからの距離に比例）
      const baseScale = 50; // ベーススケール
      const baseHeight = 12.5;
      const sizeMultiplier = (shape.textSize || 14) / 14; // テキストサイズ倍率
      
      sprite.scale.set(baseScale * sizeMultiplier, baseHeight * sizeMultiplier, 1);
      sprite.renderOrder = 999; // 最前面に描画
      sprite.position.set(
        posX + ((lineLength + tooltipOffset) * directionMultiplier), 
        posY + (lineLength * 0.7 * directionMultiplier), 
        posZ
      );
      sprite.userData = { 
        annotationIndex: i, 
        text: text,
        baseScale: baseScale * sizeMultiplier,
        baseHeight: baseHeight * sizeMultiplier,
        enableDistanceScaling: true, // 距離スケーリングを有効にする
        tooltipOffsetX: (lineLength + tooltipOffset) * directionMultiplier,
        tooltipOffsetY: (lineLength * 0.7) * directionMultiplier
      };
      
      // ...existing code...
    }

    group.name = shape.name;
    group.userData = { 
      shapeId: shape.id, 
      shapeType: shape.type,
      viewAngleConfig: { enabled: false }, // Annotationは視野角スケーリングを無効
      dataPointCount: maxLength
    };

    return group;
  }

  // Create 3D model object
  create3DModel(shape: any): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      const posX = this.dataProcessor.getLastDataFieldValue(shape.posX, 0);
      const posY = this.dataProcessor.getLastDataFieldValue(shape.posY, 0);
      const posZ = this.dataProcessor.getLastDataFieldValue(shape.posZ, 0);

      // URLが指定されていない場合はデフォルトキューブを作成
      if (!shape.url || shape.url.trim() === '') {
        const model = this.createDefaultCube(shape, posX, posY, posZ);
        resolve(model);
        return;
      }

      // 非同期処理のバージョン管理
      const currentVersion = (this.loadingVersions.get(shape.id) || 0) + 1;
      this.loadingVersions.set(shape.id, currentVersion);

      this.gltfLoader.load(
        shape.url,
        (gltf) => {
          // 古いバージョンの結果は無視
          if (this.loadingVersions.get(shape.id) !== currentVersion) {
            console.log(`Ignoring outdated model load for ${shape.name} (version ${currentVersion})`);
            return;
          }

          // Keep the transforms authored in the model and apply telemetry/unit scaling
          // to a dedicated wrapper group.
          const model = new THREE.Group();
          const modelContent = gltf.scene;
          model.add(modelContent);

          // 3Dモデルのマテリアルを改善して均等な照明を確保
          modelContent.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              // 元のマテリアルがある場合、より明るい設定に変更
              if (child.material) {
                // MeshLambertMaterialをMeshPhongMaterialに変更してより滑らかな照明にする
                if (child.material instanceof THREE.MeshLambertMaterial) {
                  const newMaterial = new THREE.MeshPhongMaterial({
                    color: child.material.color,
                    map: child.material.map,
                    transparent: child.material.transparent,
                    opacity: child.material.opacity,
                    side: child.material.side,
                    // 追加のプロパティで均等な照明を確保
                    shininess: 30,
                    specular: new THREE.Color(0x111111)
                  });
                  child.material = newMaterial;
                } else if (child.material instanceof THREE.MeshStandardMaterial || 
                          child.material instanceof THREE.MeshPhysicalMaterial) {
                  // PBRマテリアルの場合、roughnessを調整して反射を抑制
                  child.material.roughness = Math.min(child.material.roughness + 0.2, 1.0);
                  child.material.metalness = Math.max(child.material.metalness - 0.1, 0.0);
                }
                
                // 色の調整は行わず、ライティング設定で明度を調整
                // if (child.material.color) {
                //   child.material.color.multiplyScalar(1.05);
                // }
              }
            }
          });

          // Clone materials so this model's brightness never leaks into meshes/models that
          // might share the same material instance, then apply the shape's brightness.
          this.prepareMaterialsForBrightness(modelContent);
          this.applyBrightness(modelContent, this.dataProcessor.getBrightnessValue(shape.brightness));

          // Measure the model-authored geometry before applying scene unit scaling,
          // telemetry attitude, or a legacy manual scale.
          modelContent.updateMatrixWorld(true);
          const sizeInfo = ViewAngleScaling.calculateComplexModelSize(modelContent);

          model.position.set(posX, posY, posZ);

          // Apply rotation if quaternion is provided
          if (!isQuaternionInterpolationActive(shape as ModelShape) && shape.quatX && shape.quatY && shape.quatZ && shape.quatW) {
            const quatX = this.dataProcessor.getLastDataFieldValue(shape.quatX, 0);
            const quatY = this.dataProcessor.getLastDataFieldValue(shape.quatY, 0);
            const quatZ = this.dataProcessor.getLastDataFieldValue(shape.quatZ, 0);
            const quatW = this.dataProcessor.getLastDataFieldValue(shape.quatW, 1);
            
            model.quaternion.set(quatX, quatY, quatZ, quatW);
          }
          
          model.userData = { 
            shapeId: shape.id, 
            shapeType: shape.type,
            nativeMaxDimension: sizeInfo.maxDimension,
            meshCount: sizeInfo.meshCount,
            aspectRatio: sizeInfo.totalSize.x / sizeInfo.totalSize.y,
            volume: sizeInfo.volume,
            boundingBox: sizeInfo.boundingBox,
            originalUrl: shape.url // URLを記録して変更検出に使用
          };
          this.applyModelSizing(model, shape);

          model.name = shape.name;

          resolve(model);
        },
        (progress) => {
          // Progress monitoring without logging
        },
        (error: any) => {
          // 古いバージョンのエラーは無視
          if (this.loadingVersions.get(shape.id) !== currentVersion) {
            return;
          }
          
          console.error(`[NETWORK] Failed to load 3D model "${shape.name}":`, error);
          console.error(`[NETWORK] Error type:`, error.constructor?.name || 'Unknown');
          console.error(`[NETWORK] Error message:`, error.message || 'No message');
          
          // Additional debugging for network errors
          if (error.target && error.target.status) {
            console.error(`[NETWORK] HTTP Status:`, error.target.status, error.target.statusText);
            console.error(`[NETWORK] Response URL:`, error.target.responseURL);
          }
          
          // Check if it's a CORS error
          if (error.message && error.message.toLowerCase().includes('cors')) {
            console.error(`[NETWORK] CORS Error detected - check server CORS headers`);
          }
          
          // Check if it's a network error
          if (error.message && (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('fetch'))) {
            console.error(`[NETWORK] Network Error detected - check server availability`);
          }
          
          reject(error);
        }
      );
    });
  }

  // Update existing objects with new data
  updateObjects(objects: Shape[]): void {
    objects.forEach((shape) => {
      if (!shape.visible) {return;}

      const existingObject = this.objectsRef.current.get(shape.id);
      if (!existingObject) {return;}

      try {
        if (shape.type === 'sphere') {
          const posX = this.dataProcessor.getLastDataFieldValue(shape.posX, 0);
          const posY = this.dataProcessor.getLastDataFieldValue(shape.posY, 0);
          const posZ = this.dataProcessor.getLastDataFieldValue(shape.posZ, 0);
          
          existingObject.position.set(posX, posY, posZ);
          
          // 球体の色を更新
          if (existingObject instanceof THREE.Mesh && existingObject.material instanceof THREE.MeshLambertMaterial) {
            existingObject.material.color.set(shape.color || '#ff0000');
            // Rebaseline brightness's reference color, otherwise applyBrightness below would
            // overwrite this new color with the stale one captured at creation time.
            existingObject.material.userData.baseColor = existingObject.material.color.clone();
          }
          
          if (existingObject instanceof THREE.Mesh) {
            const radius = shape.autoRadius === 'off' ? (shape.radius ?? 1) : 1;
            this.setSphereGeometryRadius(existingObject, radius);
            existingObject.scale.setScalar(1);
            existingObject.userData.originalSize = radius * 2;
          }

          existingObject.userData.viewAngleConfig = this.createViewAngleConfig(shape.autoRadius === 'on');
          existingObject.userData.originalScale = this.getLegacyAutoScaleFactor(shape);
          this.applyBrightness(existingObject, this.dataProcessor.getBrightnessValue(shape.brightness));

        } else if (shape.type === 'annotation') {
          // Update annotation text and positions
          this.updateAnnotationText(existingObject as THREE.Group, null, shape);
          
        } else if (shape.type === '3dmodel') {
          const posX = this.dataProcessor.getLastDataFieldValue(shape.posX, 0);
          const posY = this.dataProcessor.getLastDataFieldValue(shape.posY, 0);
          const posZ = this.dataProcessor.getLastDataFieldValue(shape.posZ, 0);
          
          // URLが変更された場合は完全に再作成
          const currentUrl = existingObject.userData.originalUrl || '';
          const newUrl = shape.url || '';
          
          if (currentUrl !== newUrl) {
            console.log(`3D model URL changed for ${shape.name}, recreating object`);
            // 既存オブジェクトを削除
            this.removeObjectsFromScene([shape.id]);
            
            // 新しいモデルを非同期で作成して追加
            this.create3DModel(shape).then((newModel) => {
              // 最新のバージョンチェック（競合状態を防ぐ）
              const currentVersion = this.loadingVersions.get(shape.id) || 0;
              if (this.loadingVersions.get(shape.id) === currentVersion) {
                this.addObjectToScene(newModel, shape.id);
              }
            }).catch((error) => {
              console.error(`Failed to recreate 3D model for ${shape.name}:`, error);
            });
            
            return; // 他の更新処理はスキップ
          }
          
          // URLが同じ場合は位置とスケールのみ更新
          existingObject.position.set(posX, posY, posZ);
          
          // クオータニオンを更新
          if (!isQuaternionInterpolationActive(shape) && shape.quatX && shape.quatY && shape.quatZ && shape.quatW) {
            const quatX = this.dataProcessor.getLastDataFieldValue(shape.quatX, 0);
            const quatY = this.dataProcessor.getLastDataFieldValue(shape.quatY, 0);
            const quatZ = this.dataProcessor.getLastDataFieldValue(shape.quatZ, 0);
            const quatW = this.dataProcessor.getLastDataFieldValue(shape.quatW, 1);
            
            existingObject.quaternion.set(quatX, quatY, quatZ, quatW);
          }
          
          this.applyModelSizing(existingObject, shape);
          this.applyBrightness(existingObject, this.dataProcessor.getBrightnessValue(shape.brightness));

          // URLを更新
          existingObject.userData.originalUrl = newUrl;
          
        } else if (shape.type === 'polyline') {
          // ポリライン全体を再作成する必要がある（ポイントデータの変更の可能性があるため）
          this.removeObjectsFromScene([shape.id]);
          const newPolyline = this.createPolyline(shape);
          this.addObjectToScene(newPolyline, shape.id);
        }
      } catch (error) {
        console.warn('Error updating object:', shape.name, error);
      }
    });
  }

  private updateAnnotationText(group: THREE.Group, textData: any, shape: any): void {
    // fieldとconstの混在チェック - 位置データ
    const hasConstPos = [shape.posX, shape.posY, shape.posZ].some(field => field.sourceType === 'const');
    const hasFieldPos = [shape.posX, shape.posY, shape.posZ].some(field => field.sourceType === 'field');
    const mixedPos = hasConstPos && hasFieldPos;
    
    // fieldとconstの混在チェック - テキストデータ
    const hasFieldText = shape.text.sourceType === 'field';
    const hasConstText = shape.text.sourceType === 'const';
    const mixedWithText = (hasConstPos || hasFieldPos) && hasFieldText;
    
    // XYZがfieldで配列、textがconstantの場合の特別処理
    const allPosField = [shape.posX, shape.posY, shape.posZ].every(field => field.sourceType === 'field');
    const xyzFieldTextConst = allPosField && hasConstText;
    
    // 位置データを取得
    let posXArray, posYArray, posZArray;
    if (mixedPos) {
      // 混在の場合は最後の値のみ
      posXArray = [this.dataProcessor.getLastDataFieldValue(shape.posX, 0)];
      posYArray = [this.dataProcessor.getLastDataFieldValue(shape.posY, 0)];
      posZArray = [this.dataProcessor.getLastDataFieldValue(shape.posZ, 0)];
    } else if (xyzFieldTextConst) {
      // XYZがfield配列、textがconstantの場合は最後の位置のみ
      posXArray = [this.dataProcessor.getLastDataFieldValue(shape.posX, 0)];
      posYArray = [this.dataProcessor.getLastDataFieldValue(shape.posY, 0)];
      posZArray = [this.dataProcessor.getLastDataFieldValue(shape.posZ, 0)];
    } else {
      // 通常の処理
      posXArray = this.dataProcessor.getDataFieldValue(shape.posX, 0);
      posYArray = this.dataProcessor.getDataFieldValue(shape.posY, 0);
      posZArray = this.dataProcessor.getDataFieldValue(shape.posZ, 0);
    }
    
    // テキストデータを取得（混在の場合は最後の値のみ）
    const textArray = mixedWithText ? 
      [this.dataProcessor.getFieldValueAsString(shape.text, '')[this.dataProcessor.getFieldValueAsString(shape.text, '').length - 1] || 'Point 1'] : 
      this.dataProcessor.getFieldValueAsString(shape.text, '');

    const maxLength = Math.max(posXArray.length, posYArray.length, posZArray.length, textArray.length);
    
    // 既存のオブジェクトをクリア
    while (group.children.length > 0) {
      const child = group.children[0];
      if (child instanceof THREE.Sprite && child.material instanceof THREE.SpriteMaterial) {
        child.material.map?.dispose();
        child.material.dispose();
      } else if (child instanceof THREE.Line && child.material instanceof THREE.LineBasicMaterial) {
        child.material.dispose();
        if (child.geometry) {
          child.geometry.dispose();
        }
      }
      group.remove(child);
    }

    // 新しいアノテーション（線+ツールチップ）を作成
    for (let i = 0; i < maxLength; i++) {
      const posX = i < posXArray.length ? posXArray[i] : (posXArray.length > 0 ? posXArray[posXArray.length - 1] : 0);
      const posY = i < posYArray.length ? posYArray[i] : (posYArray.length > 0 ? posYArray[posYArray.length - 1] : 0);
      const posZ = i < posZArray.length ? posZArray[i] : (posZArray.length > 0 ? posZArray[posZArray.length - 1] : 0);
      const text = i < textArray.length ? textArray[i] : (textArray.length > 0 ? textArray[textArray.length - 1] : `Point ${i + 1}`);

      // Skip empty text
      if (!text || text.trim() === '') {
        continue;
      }

      // アノテーションの色を決定（shape.colorまたはtextColorを使用）
      const annotationColor = shape.color || shape.textColor || '#ffffff';

      // 線の長さとオフセットを設定（元の半分に変更）
      const lineLength = 15; // 線の長さ（30から15に変更）
      const tooltipOffset = 7.5; // ツールチップの追加オフセット（15から7.5に変更）

      // 線の方向を決定（normal: 右上方向、inverted: 左下方向）
      const isInverted = shape.lineDirection === 'inverted';
      const directionMultiplier = isInverted ? -1 : 1;

      // 線の作成（方向に応じて座標を計算）
      const lineGeometry = new THREE.BufferGeometry();
      const linePositions = new Float32Array([
        posX, posY, posZ, // 開始点（指定位置）
        posX + (lineLength * 0.7 * directionMultiplier), posY + (lineLength * 0.7 * directionMultiplier), posZ, // 中間点
        posX + ((lineLength + tooltipOffset) * directionMultiplier), posY + (lineLength * 0.7 * directionMultiplier), posZ // 終点（ツールチップ位置）
      ]);
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
      
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: annotationColor,
        linewidth: 2,
        transparent: true,
        opacity: 0.8
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.userData = { 
        annotationIndex: i,
        baseLineLength: lineLength,
        tooltipOffset: tooltipOffset
      };
      group.add(line);

      // ツールチップの作成
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = 256;
      canvas.height = 64;

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Measure text to calculate tooltip size
      context.font = `${shape.textSize || 14}px Arial`;
      const textMetrics = context.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = shape.textSize || 14;
      
      // Calculate tooltip dimensions with padding
      const padding = 8;
      const tooltipWidth = textWidth + padding * 2;
      const tooltipHeight = textHeight + padding * 2;
      const cornerRadius = 4;
      
      // Center the tooltip on canvas
      const tooltipX = (canvas.width - tooltipWidth) / 2;
      const tooltipY = (canvas.height - tooltipHeight) / 2;
      
      // Draw shadow
      context.shadowColor = 'rgba(0, 0, 0, 0.3)';
      context.shadowBlur = 4;
      context.shadowOffsetX = 2;
      context.shadowOffsetY = 2;
      
      // Draw tooltip background with rounded corners using annotation color
      const rgbColor = this.hexToRgb(annotationColor);
      context.fillStyle = `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.9)`; // 透明度付きの指定色
      context.strokeStyle = annotationColor; // 同じ色でボーダー
      context.lineWidth = 2;
      
      this.drawRoundedRect(context, tooltipX, tooltipY, tooltipWidth, tooltipHeight, cornerRadius);
      context.fill();
      
      // Reset shadow for border
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
      
      // Draw border
      this.drawRoundedRect(context, tooltipX, tooltipY, tooltipWidth, tooltipHeight, cornerRadius);
      context.stroke();
      
      // Draw text - 背景が濃い場合は白、明るい場合は黒
      const textColor = this.getContrastColor(annotationColor);
      context.fillStyle = textColor;
      context.font = `${shape.textSize || 14}px Arial`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, canvas.width / 2, canvas.height / 2);

      
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({
        map: texture,
        alphaTest: 0.01,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      
      // 距離に基づくスケーリングを計算（カメラからの距離に比例）
      const baseScale = 50; // ベーススケール
      const baseHeight = 12.5;
      const sizeMultiplier = (shape.textSize || 14) / 14; // テキストサイズ倍率
      
      sprite.scale.set(baseScale * sizeMultiplier, baseHeight * sizeMultiplier, 1);
      sprite.renderOrder = 999; // 最前面に描画
      sprite.position.set(
        posX + ((lineLength + tooltipOffset) * directionMultiplier), 
        posY + (lineLength * 0.7 * directionMultiplier), 
        posZ
      );
      sprite.userData = { 
        annotationIndex: i, 
        text: text,
        baseScale: baseScale * sizeMultiplier,
        baseHeight: baseHeight * sizeMultiplier,
        enableDistanceScaling: true, // 距離スケーリングを有効にする
        tooltipOffsetX: (lineLength + tooltipOffset) * directionMultiplier,
        tooltipOffsetY: (lineLength * 0.7) * directionMultiplier
      };
      
      group.add(sprite);
    }

    // グループのユーザーデータも更新
    group.userData.dataPointCount = maxLength;
  }

  // Remove objects from scene
  removeObjectsFromScene(objectsToRemove: string[]): void {
    objectsToRemove.forEach(id => {
      const object = this.objectsRef.current.get(id);
      if (object) {
        // ジオメトリとマテリアルを適切にdisposeしてメモリリークを防ぐ
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                  // テクスチャも適切に解放
                  if (mat.map) {mat.map.dispose();}
                  if (mat.normalMap) {mat.normalMap.dispose();}
                  if (mat.roughnessMap) {mat.roughnessMap.dispose();}
                  if (mat.metalnessMap) {mat.metalnessMap.dispose();}
                  mat.dispose();
                });
              } else {
                // テクスチャも適切に解放
                if (child.material.map) {child.material.map.dispose();}
                if (child.material.normalMap) {child.material.normalMap.dispose();}
                if (child.material.roughnessMap) {child.material.roughnessMap.dispose();}
                if (child.material.metalnessMap) {child.material.metalnessMap.dispose();}
                child.material.dispose();
              }
            }
          } else if (child instanceof THREE.Line) {
            if (child.geometry) {child.geometry.dispose();}
            if (child.material && !Array.isArray(child.material)) {
              child.material.dispose();
            }
          } else if (child instanceof THREE.Sprite) {
            if (child.material && child.material.map) {
              child.material.map.dispose();
            }
            if (child.material) {
              child.material.dispose();
            }
          }
        });
        
        this.scene.remove(object);
        this.objectsRef.current.delete(id);
      }
    });
  }

  // Add object to scene
  addObjectToScene(object: THREE.Object3D, id: string): void {
    this.scene.add(object);
    this.objectsRef.current.set(id, object);
  }

  // 視野角ベースのスケーリングを更新
  updateViewAngleScaling(): void {
    if (!this.camera) {
      console.warn('Camera not set, skipping view angle scaling update');
      return;
    }

    this.objectsRef.current.forEach((object, id) => {
      // アノテーションの距離スケーリングを処理
      if (object.userData.shapeType === 'annotation') {
        this.updateAnnotationDistanceScaling(object as THREE.Group);
        return;
      }

      // 通常のビューアングルスケーリング
      const config = object.userData.viewAngleConfig;
      if (!config) {
        return;
      }
      
      if (!config.enabled) {
        return;
      }

      try {
        const scale = ViewAngleScaling.calculateViewBasedScale(object, this.camera!, config);
        const adjustedScale = ViewAngleScaling.applyShapeAdjustment(object, scale);
        
        // スケールを適用（元のスケールは保持）
        const originalScale = object.userData.originalScale || 1.0;
        object.scale.setScalar(originalScale * adjustedScale);
      } catch (error) {
        console.warn(`Error updating view angle scaling for ${object.name || 'unnamed'}:`, error);
      }
    });
  }

  // アノテーションの距離スケーリングを更新
  private updateAnnotationDistanceScaling(group: THREE.Group): void {
    if (!this.camera) {return;}

    // アノテーションの基準位置を取得（最初のスプライトまたは線の位置）
    let basePosition: THREE.Vector3 | null = null;
    
    // 最初に基準位置を見つける
    for (const child of group.children) {
      if (child instanceof THREE.Sprite || child instanceof THREE.Line) {
        if (child instanceof THREE.Line) {
          // 線の開始点を基準位置とする
          const positions = child.geometry.attributes.position.array as Float32Array;
          basePosition = new THREE.Vector3(positions[0], positions[1], positions[2]);
        } else {
          // スプライトの場合は、オフセットを考慮した元の位置を計算
          const offsetX = child.userData.tooltipOffsetX || 0;
          const offsetY = child.userData.tooltipOffsetY || 0;
          basePosition = new THREE.Vector3(
            child.position.x - offsetX,
            child.position.y - offsetY,
            child.position.z
          );
        }
        break;
      }
    }

    if (!basePosition) {return;}

    const distance = this.camera.position.distanceTo(basePosition);
    
    // 距離に比例したスケーリング（距離が遠いほど大きくする）
    // 基準距離を100として、距離に比例してスケールを調整
    const referenceDistance = 100;
    const distanceScale = Math.max(0.1, distance / referenceDistance); // 最小0.1倍

    group.children.forEach((child) => {
      if (child instanceof THREE.Sprite && child.userData.enableDistanceScaling) {
        const finalScaleX = child.userData.baseScale * distanceScale;
        const finalScaleY = child.userData.baseHeight * distanceScale;
        
        child.scale.set(finalScaleX, finalScaleY, 1);
      } else if (child instanceof THREE.Line && child.userData.baseLineLength) {
        // 線のスケーリング：距離に応じて線の長さと位置を調整
        const scaledLineLength = child.userData.baseLineLength * distanceScale;
        const scaledTooltipOffset = child.userData.tooltipOffset * distanceScale;
        
        // 線の座標を更新
        const positions = child.geometry.attributes.position.array as Float32Array;
        const startX = positions[0];
        const startY = positions[1];
        const startZ = positions[2];
        
        // 新しい座標を計算
        positions[3] = startX + scaledLineLength * 0.7; // 右上点のX
        positions[4] = startY + scaledLineLength * 0.7; // 右上点のY
        positions[6] = startX + scaledLineLength + scaledTooltipOffset; // 終点のX
        positions[7] = startY + scaledLineLength * 0.7; // 終点のY
        
        child.geometry.attributes.position.needsUpdate = true;
        
        // 対応するスプライトの位置も更新
        const correspondingSprite = group.children.find(c => 
          c instanceof THREE.Sprite && 
          c.userData.annotationIndex === child.userData.annotationIndex
        ) as THREE.Sprite;
        
        if (correspondingSprite) {
          correspondingSprite.position.set(
            startX + scaledLineLength + scaledTooltipOffset,
            startY + scaledLineLength * 0.7,
            startZ
          );
        }
      }
    });
  }

  // オブジェクトの元のスケールを保存（手動スケール変更時に呼び出し）
  saveOriginalScale(objectId: string, scale: number): void {
    const object = this.objectsRef.current.get(objectId);
    if (object) {
      object.userData.originalScale = scale;
    }
  }

  // Create default cube when no URL is specified
  private createDefaultCube(shape: any, posX: number, posY: number, posZ: number): THREE.Group {
    const group = new THREE.Group();
    
    // 1辺の長さが2*sqrt(3)/3の正六面体を作成
    const cubeSize = (2 * Math.sqrt(3)) / 3;
    const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    
    // デフォルトマテリアル（グレー色）
    const material = new THREE.MeshLambertMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.8
    });
    const cube = new THREE.Mesh(geometry, material);
    group.add(cube);
    this.prepareMaterialsForBrightness(group);
    this.applyBrightness(group, this.dataProcessor.getBrightnessValue(shape.brightness));

    // 位置を設定
    group.position.set(posX, posY, posZ);

    // クオータニオンを適用
    if (!isQuaternionInterpolationActive(shape as ModelShape) && shape.quatX && shape.quatY && shape.quatZ && shape.quatW) {
      const quatX = this.dataProcessor.getLastDataFieldValue(shape.quatX, 0);
      const quatY = this.dataProcessor.getLastDataFieldValue(shape.quatY, 0);
      const quatZ = this.dataProcessor.getLastDataFieldValue(shape.quatZ, 0);
      const quatW = this.dataProcessor.getLastDataFieldValue(shape.quatW, 1);
      
      group.quaternion.set(quatX, quatY, quatZ, quatW);
    }

    // キューブ自身が定義するネイティブサイズ情報
    const sizeInfo = {
      maxDimension: cubeSize,
      totalSize: new THREE.Vector3(cubeSize, cubeSize, cubeSize),
      meshCount: 1,
      volume: cubeSize * cubeSize * cubeSize,
      boundingBox: new THREE.Box3(
        new THREE.Vector3(-cubeSize/2, -cubeSize/2, -cubeSize/2),
        new THREE.Vector3(cubeSize/2, cubeSize/2, cubeSize/2)
      )
    };

    group.userData = { 
      shapeId: shape.id, 
      shapeType: shape.type,
      nativeMaxDimension: sizeInfo.maxDimension,
      meshCount: sizeInfo.meshCount,
      aspectRatio: 1.0, // 正六面体なので1:1:1
      volume: sizeInfo.volume,
      boundingBox: sizeInfo.boundingBox,
      isDefaultCube: true, // デフォルトキューブであることを示すフラグ
      originalUrl: shape.url || '' // URLを記録して変更検出に使用
    };
    this.applyModelSizing(group, shape);

    group.name = shape.name;

    return group;
  }

  // Helper method to draw rounded rectangles for tooltip backgrounds
  private drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  // Helper method to convert hex color to RGB
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Convert 3-digit hex to 6-digit
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return { r, g, b };
  }

  // Helper method to get contrasting text color
  private getContrastColor(backgroundColor: string): string {
    const rgb = this.hexToRgb(backgroundColor);
    
    // Calculate relative luminance
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    
    // Return white for dark colors, black for light colors
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  // リソースのクリーンアップ
  dispose(): void {
    this.loadingVersions.clear();
  }
}
