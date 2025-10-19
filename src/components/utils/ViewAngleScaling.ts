import * as THREE from 'three';

export interface ViewAngleScalingConfig {
  enabled: boolean;
  targetAngularSize: number; // ラジアン単位
  minSize: number;
  maxSize: number;
}

export class ViewAngleScaling {
  /**
   * カメラからオブジェクトまでの距離に基づいて、視野角が一定になるようなスケールを計算
   * @param object - スケールを計算するオブジェクト
   * @param camera - カメラ
   * @param config - スケーリング設定
   * @returns 計算されたスケール値
   */
  static calculateViewBasedScale(
    object: THREE.Object3D,
    camera: THREE.Camera,
    config: ViewAngleScalingConfig
  ): number {
    if (!config.enabled) {
      return 1.0;
    }

    const distance = camera.position.distanceTo(object.position);
    if (distance === 0) {
      return 1.0;
    }

    // 目標角度サイズから必要なサイズを計算
    // 角度サイズ = 2 * arctan(サイズ / (2 * 距離))
    // サイズ = 2 * 距離 * tan(角度サイズ / 2)
    const requiredSize = 2 * distance * Math.tan(config.targetAngularSize / 2);
    
    // オブジェクトの元のサイズを取得
    const originalSize = this.getObjectSize(object);
    
    // スケール計算
    const scale = requiredSize / originalSize;
    
    // 最小・最大サイズでクランプ
    return Math.max(config.minSize, Math.min(config.maxSize, scale));
  }

  /**
   * オブジェクトのサイズを計算（バウンディングボックスの最大次元）
   * @param object - サイズを計算するオブジェクト
   * @returns オブジェクトのサイズ
   */
  private static getObjectSize(object: THREE.Object3D): number {
    // ユーザーデータに保存された元のサイズがあれば使用
    if (object.userData.originalSize) {
      return object.userData.originalSize;
    }

    // バウンディングボックスから計算
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    
    // 計算結果をキャッシュ
    object.userData.originalSize = maxDimension;
    
    return maxDimension;
  }

  /**
   * 複雑なモデル（複数のメッシュを含むグループ）のサイズを計算
   * @param model - サイズを計算するモデル
   * @returns モデルサイズ情報
   */
  static calculateComplexModelSize(model: THREE.Object3D) {
    const meshes: THREE.Mesh[] = [];
    const totalBox = new THREE.Box3();
    
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child);
        const meshBox = new THREE.Box3().setFromObject(child);
        totalBox.union(meshBox);
      }
    });
    
    const size = totalBox.getSize(new THREE.Vector3());
    const center = totalBox.getCenter(new THREE.Vector3());
    
    return {
      meshCount: meshes.length,
      totalSize: size,
      center: center,
      maxDimension: Math.max(size.x, size.y, size.z),
      volume: size.x * size.y * size.z,
      meshes: meshes,
      boundingBox: totalBox,
      boundingSphere: {
        center: center,
        radius: size.length() / 2
      }
    };
  }

  /**
   * オブジェクトの形状に基づくスケール調整
   * @param object - 調整するオブジェクト
   * @param baseScale - ベースとなるスケール
   * @returns 調整されたスケール
   */
  static applyShapeAdjustment(object: THREE.Object3D, baseScale: number): number {
    // アスペクト比に基づく調整
    const aspectRatio = object.userData.aspectRatio || 1.0;
    const shapeAdjustment = Math.max(0.5, Math.min(2.0, aspectRatio));
    
    return baseScale * shapeAdjustment;
  }

  /**
   * デフォルトの視野角スケーリング設定を取得
   * @returns デフォルト設定
   */
  static getDefaultConfig(): ViewAngleScalingConfig {
    return {
      enabled: false,
      targetAngularSize: 0.02, // 約1.15度
      minSize: 0.1,
      maxSize: 10.0
    };
  }
}
