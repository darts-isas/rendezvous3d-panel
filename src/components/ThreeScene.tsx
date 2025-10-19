import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Shape, CameraSettings, ViewAngleScalingSettings } from '../types';
import { PanelData } from '@grafana/data';
import { DataFieldProcessor, BoundsCalculator, CameraController } from './utils/ThreeSceneHelpers';
import { ThreeSceneObjectManager } from './utils/ThreeSceneObjectManager';
import { EnvironmentMapGenerator } from './utils/EnvironmentMapGenerator';

interface ThreeSceneProps {
  width: number;
  height: number;
  backgroundColor: string;
  showAxis: boolean;
  objects?: Shape[];
  data?: PanelData;
  directionalLightIntensity?: number;
  ambientLightIntensity?: number;
  environmentMapIntensity?: number;
  targetObjectId?: string;
  enableCameraControls?: boolean;
  cameraSettings?: CameraSettings;
  viewAngleScaling?: ViewAngleScalingSettings;
}

export const ThreeScene: React.FC<ThreeSceneProps> = ({
  width,
  height,
  backgroundColor,
  showAxis,
  objects = [],
  data,
  directionalLightIntensity = 0.4,
  ambientLightIntensity = 0.3,
  environmentMapIntensity = 0.6,
  targetObjectId = 'origin',
  enableCameraControls = true,
  cameraSettings,
  viewAngleScaling,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const controlsRef = useRef<OrbitControls>();
  const animationIdRef = useRef<number>();
  const [isInitialized, setIsInitialized] = useState(false);
  const objectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const distanceDisplayRef = useRef<HTMLDivElement>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight>();
  const ambientLightRef = useRef<THREE.AmbientLight>();
  const [currentDistance, setCurrentDistance] = useState<number>(0);
  const [currentPosition, setCurrentPosition] = useState<THREE.Vector3>(new THREE.Vector3());

  // Helper classes
  const [dataProcessor] = useState(() => new DataFieldProcessor(data));
  const [boundsCalculator] = useState(() => new BoundsCalculator(dataProcessor));
  const [objectManager, setObjectManager] = useState<ThreeSceneObjectManager | null>(null);
  const [cameraController, setCameraController] = useState<CameraController | null>(null);
  const [environmentMapGenerator, setEnvironmentMapGenerator] = useState<EnvironmentMapGenerator | null>(null);

  // Update data processor when data changes
  useEffect(() => {
    dataProcessor.setData(data);
  }, [data, dataProcessor]);

  // Listen for camera position requests
  useEffect(() => {
    const handleCameraPositionRequest = (event: MessageEvent) => {
      if (event.data && event.data.type === 'camera-current-position-request' && cameraRef.current) {
        const camera = cameraRef.current;
        
        // Calculate distance to target
        let targetPosition = new THREE.Vector3(0, 0, 0);
        if (targetObjectId !== 'origin') {
          const targetObject = objectsRef.current.get(targetObjectId);
          if (targetObject) {
            targetPosition = targetObject.position;
          }
        }
        
        const distance = camera.position.distanceTo(targetPosition);
        
        const responseEvent = {
          type: 'camera-current-position-response',
          posX: camera.position.x,
          posY: camera.position.y,
          posZ: camera.position.z,
          distance: distance,
          timestamp: Date.now()
        };
        
        window.postMessage(responseEvent, '*');
      }
    };

    window.addEventListener('message', handleCameraPositionRequest);
    
    return () => {
      window.removeEventListener('message', handleCameraPositionRequest);
    };
  }, [targetObjectId]);

  // Initialize Three.js scene
  const initializeScene = useCallback(() => {
    if (!mountRef.current || isInitialized) {
      return;
    }

    // Prevent multiple initializations
    if (rendererRef.current) {
      return;
    }

    try {
      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(backgroundColor);
      sceneRef.current = scene;

      // Camera setup
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.001, 15000000000);
      camera.position.set(50, 50, 50);
      camera.lookAt(0, 0, 0);  // Ensure camera looks at origin
      cameraRef.current = camera;

      // Renderer setup
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // トーンマッピングを調整
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.toneMappingExposure = 1.0;
      
      rendererRef.current = renderer;

      // Controls setup
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enabled = enableCameraControls;
      controls.target.set(0, 0, 0);  // Set target to origin
      controls.update();  // Apply the target setting
      controlsRef.current = controls;

      // 並行光源の設定
      const directionalLight = new THREE.DirectionalLight(0xffffff, directionalLightIntensity);
      directionalLight.position.set(100, 100, 50);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      scene.add(directionalLight);
      directionalLightRef.current = directionalLight;

      // アンビエント光の設定
      const ambientLight = new THREE.AmbientLight(0xffffff, ambientLightIntensity);
      scene.add(ambientLight);
      ambientLightRef.current = ambientLight;

      // 環境マップの生成と設定
      const envMapGen = new EnvironmentMapGenerator(renderer, 256);
      setEnvironmentMapGenerator(envMapGen);
      
      // 環境マップを生成してシーンに適用（強度が0でなければ）
      if (environmentMapIntensity > 0) {
        const environmentMap = envMapGen.generateEnvironmentMap();
        scene.environment = environmentMap;
        scene.environmentIntensity = environmentMapIntensity; // プロパティから設定
      }

      // Add coordinate axes if enabled (will be managed by separate useEffect)
      // Initial axis setup is handled by the axis visibility useEffect

      // Initialize helper classes
      const objManager = new ThreeSceneObjectManager(scene, dataProcessor, objectsRef, viewAngleScaling);
      objManager.setCamera(camera); // カメラ参照を設定
      setObjectManager(objManager);

      const camController = new CameraController(camera, controls, boundsCalculator, objectsRef, dataProcessor);
      setCameraController(camController);

      // Add renderer to DOM
      mountRef.current.appendChild(renderer.domElement);

      // Force initial render
      renderer.render(scene, camera);

      setIsInitialized(true);
    } catch (error) {
      console.error('Error during scene initialization:', error);
    }
  }, [
    width,
    height,
    isInitialized,
    environmentMapIntensity
  ]);

  // Animation loop
  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) {
      return;
    }

    controlsRef.current.update();
    
    // 視野角ベースのスケーリングを更新
    if (objectManager) {
      objectManager.updateViewAngleScaling();
    }

    // 距離表示が有効な場合、カメラとターゲットオブジェクト間の距離を計算
    if (cameraSettings?.showPositionAndDistance === 'on') {
      let targetPosition = new THREE.Vector3(0, 0, 0); // Default to origin
      
      if (targetObjectId !== 'origin') {
        const targetObject = objectsRef.current.get(targetObjectId);
        if (targetObject) {
          targetPosition = targetObject.position;
        }
      }
      
      const distance = cameraRef.current.position.distanceTo(targetPosition);
      setCurrentDistance(distance);
      setCurrentPosition(cameraRef.current.position.clone());
    }
    
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationIdRef.current = requestAnimationFrame(animate);
  }, [objectManager, cameraSettings?.showPositionAndDistance, targetObjectId]);

  // Update objects based on shape configuration
  const updateObjects = useCallback(async () => {
    if (!sceneRef.current || !objectManager) return;

    // Get current object IDs
    const currentObjectIds = new Set(objectsRef.current.keys());
    const newObjectIds = new Set(objects.filter(obj => obj.visible).map(obj => obj.id));

    // Remove objects that are no longer needed or not visible
    const objectsToRemove = [...currentObjectIds].filter(id => !newObjectIds.has(id));
    objectManager.removeObjectsFromScene(objectsToRemove);

    // Add or update objects
    for (const shape of objects) {
      if (!shape.visible) {
        // Remove object if it exists but is no longer visible
        if (objectsRef.current.has(shape.id)) {
          objectManager.removeObjectsFromScene([shape.id]);
        }
        continue;
      }

      try {
        const existingObject = objectsRef.current.get(shape.id);
        
        if (existingObject) {
          // Update existing object properties - this ensures all changes are reflected
          objectManager.updateObjects([shape]);
        } else {
          // Create new object
          let newObject: THREE.Object3D | null = null;

          switch (shape.type) {
            case 'sphere':
              newObject = objectManager.createSphere(shape);
              break;
            case 'polyline':
              newObject = objectManager.createPolyline(shape);
              break;
            case 'annotation':
              newObject = objectManager.createAnnotation(shape);
              break;
            case '3dmodel':
              try {
                newObject = await objectManager.create3DModel(shape);
              } catch (error) {
                console.error(`Failed to load 3D model for ${shape.name}:`, error);
                continue;
              }
              break;
            default:
              console.warn(`Unknown shape type: ${(shape as any).type}`);
              continue;
          }

          if (newObject) {
            objectManager.addObjectToScene(newObject, shape.id);
          }
        }
      } catch (error) {
        console.error(`Error creating/updating object ${shape.name}:`, error);
      }
    }
  }, [objects, objectManager]);

  // Update environment map lighting and directional light
  const updateLighting = useCallback(() => {
    if (sceneRef.current) {
      // 並行光源の強度更新
      if (directionalLightRef.current) {
        directionalLightRef.current.intensity = directionalLightIntensity;
      }
      
      // アンビエント光の強度更新
      if (ambientLightRef.current) {
        ambientLightRef.current.intensity = ambientLightIntensity;
      }
      
      // 環境マップの強度更新
      if (sceneRef.current) {
        // 環境マップが設定されていない場合は再生成
        if (!sceneRef.current.environment && environmentMapGenerator) {
          const environmentMap = environmentMapGenerator.generateEnvironmentMap();
          sceneRef.current.environment = environmentMap;
        }
        // environmentIntensityを設定
        sceneRef.current.environmentIntensity = environmentMapIntensity;
        
        // 全マテリアルの環境マップ強度を設定
        sceneRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            if (child.material instanceof THREE.MeshStandardMaterial || 
                child.material instanceof THREE.MeshPhysicalMaterial) {
              child.material.envMapIntensity = environmentMapIntensity;
              child.material.needsUpdate = true;
            }
          }
        });
      }
    }
    // 環境マップジェネレーターの強度も更新
    if (environmentMapGenerator) {
      environmentMapGenerator.updateIntensity(environmentMapIntensity * 0.7); // 少し控えめに
    }
  }, [environmentMapIntensity, directionalLightIntensity, ambientLightIntensity, environmentMapGenerator]);

  // Initialize scene on mount
  useEffect(() => {
    initializeScene();
    
    // Store current refs for cleanup
    const currentRenderer = rendererRef.current;
    const currentMount = mountRef.current;
    const currentAnimation = animationIdRef.current;
    
    return () => {
      if (currentAnimation) {
        cancelAnimationFrame(currentAnimation);
      }
      if (currentRenderer && currentMount && currentRenderer.domElement.parentNode === currentMount) {
        try {
          currentMount.removeChild(currentRenderer.domElement);
        } catch (error) {
          console.warn('Error removing canvas from DOM:', error);
        }
      }
      if (currentRenderer) {
        currentRenderer.dispose();
      }
      // ObjectManagerのクリーンアップ
      if (objectManager) {
        objectManager.dispose();
      }
      // EnvironmentMapGeneratorのクリーンアップ
      if (environmentMapGenerator) {
        environmentMapGenerator.dispose();
      }
    };
  }, []); // Empty dependency array to run only once

  // Start animation loop
  useEffect(() => {
    if (isInitialized) {
      animate();
    }
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [isInitialized, animate]);

  // Update renderer size
  useEffect(() => {
    if (rendererRef.current && cameraRef.current) {
      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    }
  }, [width, height]);

  // Update background color
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(backgroundColor);
    }
  }, [backgroundColor]);

  // Update camera controls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = enableCameraControls;
    }
  }, [enableCameraControls]);

  // Update view angle scaling settings
  useEffect(() => {
    if (objectManager && viewAngleScaling) {
      objectManager.updateGlobalViewAngleSettings(viewAngleScaling);
    }
  }, [objectManager, viewAngleScaling]);

  // Update axis visibility
  useEffect(() => {
    if (!sceneRef.current || !isInitialized) return;
    
    // Remove existing axes
    const axesToRemove = sceneRef.current.children.filter(child => 
      child instanceof THREE.AxesHelper
    );
    axesToRemove.forEach(axis => {
      sceneRef.current!.remove(axis);
    });
    
    // Add axes if enabled
    if (showAxis) {
      const axesHelper = new THREE.AxesHelper(10);
      sceneRef.current.add(axesHelper);
      
      // Add debug axes
      const debugAxes = new THREE.AxesHelper(20);
      debugAxes.position.set(0, 0, 0);
      sceneRef.current.add(debugAxes);
    }
  }, [showAxis, isInitialized]);

  // Update lighting when intensity changes
  useEffect(() => {
    updateLighting();
  }, [updateLighting]);

  // Update objects when configuration changes
  useEffect(() => {
    if (isInitialized && objectManager) {
      updateObjects();
    }
  }, [isInitialized, updateObjects, objectManager, 
      // 追加：オブジェクトの重要な属性の変更も検出
      JSON.stringify(objects.map(obj => ({
        id: obj.id,
        type: obj.type,
        visible: obj.visible,
        // type別の重要な属性
        ...(obj.type === 'sphere' ? {
          color: obj.color,
          autoRadius: obj.autoRadius,
          radius: obj.radius,
          autoScaleFactor: obj.autoScaleFactor
        } : {}),
        ...(obj.type === 'annotation' ? {
          textSize: obj.textSize,
          textColor: obj.textColor
        } : {}),
        ...(obj.type === 'polyline' ? {
          strokeSize: obj.strokeSize,
          strokeColor: obj.strokeColor,
          closePath: obj.closePath,
          smoothCurve: obj.smoothCurve
        } : {}),
        ...(obj.type === '3dmodel' ? {
          url: obj.url,
          autoScale: obj.autoScale,
          scale: obj.scale,
          autoScaleFactor: obj.autoScaleFactor
        } : {})
      })))
  ]);

  // Update objects when data changes (time range changes, reload, etc.)
  useEffect(() => {
    if (isInitialized && objectManager && data) {
      // データが変更された場合、データプロセッサーを更新してからオブジェクトを更新
      dataProcessor.setData(data);
      updateObjects();
      
      // 強制的に次フレームで再レンダリングを実行
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        requestAnimationFrame(() => {
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
        });
      }
    }
  }, [data, isInitialized, objectManager, updateObjects, dataProcessor]);

  // Handle camera preset changes
  useEffect(() => {
    if (cameraSettings?.axisTrigger && cameraController && cameraRef.current) {
      const preset = cameraSettings.axisTrigger;
      
      if (preset && typeof preset === 'object' && preset.preset) {
        // Apply preset position directly to camera using calculated absolute positions
        const cameraX = preset.posX || 0;
        const cameraY = preset.posY || 0;
        const cameraZ = preset.posZ || 0;

        // Determine target position
        let targetX = 0, targetY = 0, targetZ = 0;
        if (targetObjectId !== 'origin') {
          const targetObject = objectsRef.current.get(targetObjectId);
          if (targetObject) {
            targetX = targetObject.position.x;
            targetY = targetObject.position.y;
            targetZ = targetObject.position.z;
          }
        }

        // Set camera position directly using absolute coordinates
        cameraRef.current.position.set(cameraX, cameraY, cameraZ);
        if (controlsRef.current) {
          controlsRef.current.target.set(targetX, targetY, targetZ);
          controlsRef.current.update();
        }
      }
    }
  }, [cameraSettings?.axisTrigger, cameraController, targetObjectId, objects, boundsCalculator]);

  // Handle manual camera position changes from UI fields
  useEffect(() => {
    if (cameraSettings && cameraController && cameraRef.current && controlsRef.current) {
      try {
        // Get camera position directly from settings
        const posX = dataProcessor.getLastDataFieldValue(cameraSettings.posX, 100);
        const posY = dataProcessor.getLastDataFieldValue(cameraSettings.posY, 100);
        const posZ = dataProcessor.getLastDataFieldValue(cameraSettings.posZ, 100);

        // Validate camera position values
        if (!isFinite(posX) || !isFinite(posY) || !isFinite(posZ)) {
          console.warn('Invalid camera position values:', { posX, posY, posZ });
          return;
        }

        // Set camera position directly
        cameraRef.current.position.set(posX, posY, posZ);

        // Determine target position for camera to look at
        let targetX = 0, targetY = 0, targetZ = 0;
        if (targetObjectId !== 'origin') {
          const targetObject = objectsRef.current.get(targetObjectId);
          if (targetObject) {
            targetX = targetObject.position.x;
            targetY = targetObject.position.y;
            targetZ = targetObject.position.z;
            
            // Validate target position values
            if (!isFinite(targetX) || !isFinite(targetY) || !isFinite(targetZ)) {
              console.warn('Invalid target position values:', { targetX, targetY, targetZ });
              targetX = targetY = targetZ = 0; // Fallback to origin
            }
          }
        }

        controlsRef.current.target.set(targetX, targetY, targetZ);
        controlsRef.current.update();
      } catch (error) {
        console.error('Error updating camera position from UI fields:', error);
      }
    }
  }, [
    cameraSettings?.posX?.sourceType, 
    cameraSettings?.posX?.value,
    cameraSettings?.posY?.sourceType, 
    cameraSettings?.posY?.value,
    cameraSettings?.posZ?.sourceType, 
    cameraSettings?.posZ?.value,
    targetObjectId,
    dataProcessor,
    cameraController,
    cameraSettings
  ]);

  // Handle immediate camera movement from presets
  useEffect(() => {
    const handleCameraMoveImmediate = (event: MessageEvent) => {
      if (event.data && event.data.type === 'camera-move-immediate' && 
          cameraRef.current && controlsRef.current && sceneRef.current) {
        const { posX, posY, posZ } = event.data;
        
        // Move camera to new position immediately
        cameraRef.current.position.set(posX, posY, posZ);
        
        // Update camera look-at target based on targetObjectId
        let targetPosition = new THREE.Vector3(0, 0, 0);
        if (targetObjectId !== 'origin') {
          const targetObject = objectsRef.current.get(targetObjectId);
          if (targetObject) {
            targetPosition = targetObject.position;
          }
        }
        
        // Update controls target and camera lookAt
        controlsRef.current.target.copy(targetPosition);
        cameraRef.current.lookAt(targetPosition);
        controlsRef.current.update();
        
        // Force a render
        if (rendererRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      }
    };

    window.addEventListener('message', handleCameraMoveImmediate);
    
    return () => {
      window.removeEventListener('message', handleCameraMoveImmediate);
    };
  }, [targetObjectId]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {cameraSettings?.showPositionAndDistance === 'on' && (
        <div
          ref={distanceDisplayRef}
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '14px',
            zIndex: 1000,
            userSelect: 'none',
            pointerEvents: 'none',
            lineHeight: '1.4',
          }}
        >
          <div>Position: X: {currentPosition.x.toFixed(2)}, Y: {currentPosition.y.toFixed(2)}, Z: {currentPosition.z.toFixed(2)}</div>
          <div>Distance: {currentDistance.toExponential(2)}</div>
        </div>
      )}
    </div>
  );
};
