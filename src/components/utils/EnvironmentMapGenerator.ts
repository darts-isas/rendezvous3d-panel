import * as THREE from 'three';

/**
 * グラデーション環境マップジェネレーター
 * プログラム的にキューブテクスチャを生成し、空間的なライティング環境を提供
 */
export class EnvironmentMapGenerator {
  private renderer: THREE.WebGLRenderer;
  private cubeRenderTarget: THREE.WebGLCubeRenderTarget;
  private cubeCamera: THREE.CubeCamera;
  private gradientScene: THREE.Scene;
  private materials: THREE.ShaderMaterial[] = [];

  // カスタマイズ可能な色設定
  public topColor: THREE.Color = new THREE.Color(0xABC0C5);      // 青白色をさらに中間色に寄せた色
  public bottomColor: THREE.Color = new THREE.Color(0xC8B6A3);   // 暖色をさらに中間色に寄せた色
  public horizonColor: THREE.Color = new THREE.Color(0xB8B8B8);  // 中間色（ニュートラルグレー）
  public intensityFactor: number = 0.7; // グローバル強度調整

  constructor(renderer: THREE.WebGLRenderer, resolution: number = 256) {
    this.renderer = renderer;
    
    // キューブレンダーターゲットの作成
    this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(resolution);
    
    // キューブカメラの作成
    this.cubeCamera = new THREE.CubeCamera(0.1, 1000, this.cubeRenderTarget);
    
    // グラデーション用のシーンを作成
    this.gradientScene = this.createGradientScene();
  }

  /**
   * グラデーション環境を表現するシーンを作成
   */
  private createGradientScene(): THREE.Scene {
    const scene = new THREE.Scene();
    
    // 各面のグラデーションジオメトリを作成
    const geometry = new THREE.PlaneGeometry(2, 2);
    
    // カスタムシェーダーマテリアルでグラデーションを作成
    const vertexShader = `
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform vec3 horizonColor;
      uniform float intensityFactor;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      
      void main() {
        vec3 direction = normalize(vWorldPosition);
        float y = direction.y;
        
        // スムーズな補間のためのパワー関数を使用
        float t = (y + 1.0) * 0.5; // -1~1 を 0~1 に変換
        t = smoothstep(0.0, 1.0, t); // よりスムーズな補間
        
        vec3 color;
        if (t > 0.5) {
          // 上半分：horizonColorからtopColorへ
          float blend = (t - 0.5) * 2.0;
          color = mix(horizonColor, topColor, blend);
        } else {
          // 下半分：bottomColorからhorizonColorへ
          float blend = t * 2.0;
          color = mix(bottomColor, horizonColor, blend);
        }
        
        // 明度を調整して過度に明るくならないようにする
        color *= intensityFactor;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    
    // 色の定義（金属に適した控えめな色調）
    const topColor = this.topColor;
    const bottomColor = this.bottomColor;
    const horizonColor = this.horizonColor;
    
    // 6面それぞれにマテリアルを作成
    this.materials = [];
    
    // +X面（右）
    this.materials.push(new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: topColor },
        bottomColor: { value: bottomColor },
        horizonColor: { value: horizonColor },
        intensityFactor: { value: this.intensityFactor }
      },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide
    }));
    
    // -X面（左）
    this.materials.push(new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: topColor },
        bottomColor: { value: bottomColor },
        horizonColor: { value: horizonColor },
        intensityFactor: { value: this.intensityFactor }
      },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide
    }));
    
    // +Y面（上）
    this.materials.push(new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: topColor },
        bottomColor: { value: topColor },
        horizonColor: { value: topColor },
        intensityFactor: { value: this.intensityFactor }
      },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide
    }));
    
    // -Y面（下）
    this.materials.push(new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: bottomColor },
        bottomColor: { value: bottomColor },
        horizonColor: { value: bottomColor },
        intensityFactor: { value: this.intensityFactor }
      },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide
    }));
    
    // +Z面（前）
    this.materials.push(new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: topColor },
        bottomColor: { value: bottomColor },
        horizonColor: { value: horizonColor },
        intensityFactor: { value: this.intensityFactor }
      },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide
    }));
    
    // -Z面（後）
    this.materials.push(new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: topColor },
        bottomColor: { value: bottomColor },
        horizonColor: { value: horizonColor },
        intensityFactor: { value: this.intensityFactor }
      },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide
    }));
    
    // キューブの各面を作成
    const positions: [number, number, number][] = [
      [1, 0, 0],   // +X
      [-1, 0, 0],  // -X
      [0, 1, 0],   // +Y
      [0, -1, 0],  // -Y
      [0, 0, 1],   // +Z
      [0, 0, -1]   // -Z
    ];
    
    const rotations: [number, number, number][] = [
      [0, Math.PI / 2, 0],     // +X
      [0, -Math.PI / 2, 0],    // -X
      [-Math.PI / 2, 0, 0],    // +Y
      [Math.PI / 2, 0, 0],     // -Y
      [0, 0, 0],               // +Z
      [0, Math.PI, 0]          // -Z
    ];
    
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(geometry, this.materials[i]);
      mesh.position.set(...positions[i]);
      mesh.rotation.set(...rotations[i]);
      scene.add(mesh);
    }
    
    return scene;
  }
  
  /**
   * 環境マップの色を更新
   */
  updateColors(topColor?: THREE.Color, bottomColor?: THREE.Color, horizonColor?: THREE.Color, intensityFactor?: number): void {
    if (topColor) this.topColor = topColor;
    if (bottomColor) this.bottomColor = bottomColor;
    if (horizonColor) this.horizonColor = horizonColor;
    if (intensityFactor !== undefined) this.intensityFactor = intensityFactor;
    
    // 全マテリアルのユニフォームを更新
    this.materials.forEach((material, index) => {
      if (index === 2) { // +Y面（上）
        material.uniforms.topColor.value = this.topColor;
        material.uniforms.bottomColor.value = this.topColor;
        material.uniforms.horizonColor.value = this.topColor;
      } else if (index === 3) { // -Y面（下）
        material.uniforms.topColor.value = this.bottomColor;
        material.uniforms.bottomColor.value = this.bottomColor;
        material.uniforms.horizonColor.value = this.bottomColor;
      } else { // 側面
        material.uniforms.topColor.value = this.topColor;
        material.uniforms.bottomColor.value = this.bottomColor;
        material.uniforms.horizonColor.value = this.horizonColor;
      }
      material.uniforms.intensityFactor.value = this.intensityFactor;
    });
  }

  /**
   * 環境マップの強度のみを更新（色は変更しない）
   */
  updateIntensity(intensityFactor: number): void {
    this.intensityFactor = intensityFactor;
    this.materials.forEach(material => {
      material.uniforms.intensityFactor.value = this.intensityFactor;
    });
  }

  /**
   * 環境マップを生成
   */
  generateEnvironmentMap(): THREE.CubeTexture {
    // 現在のレンダリング設定を保存
    const currentRenderTarget = this.renderer.getRenderTarget();
    const currentXrEnabled = this.renderer.xr.enabled;
    const currentShadowAutoUpdate = this.renderer.shadowMap.autoUpdate;
    
    // 環境マップ生成用の設定
    this.renderer.xr.enabled = false;
    this.renderer.shadowMap.autoUpdate = false;
    
    // キューブマップをレンダリング
    this.cubeCamera.position.set(0, 0, 0);
    this.cubeCamera.update(this.renderer, this.gradientScene);
    
    // 設定を復元
    this.renderer.xr.enabled = currentXrEnabled;
    this.renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
    this.renderer.setRenderTarget(currentRenderTarget);
    
    return this.cubeRenderTarget.texture;
  }
  
  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.cubeRenderTarget.dispose();
    
    // マテリアルを破棄
    this.materials.forEach(material => material.dispose());
    this.materials = [];
    
    // グラデーションシーンの各ジオメトリを破棄
    this.gradientScene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry) {
        object.geometry.dispose();
      }
    });
  }
}
