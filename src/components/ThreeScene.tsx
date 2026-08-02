import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Shape, CameraSettings, ViewAngleScalingSettings, PointLightSettings } from '../types';
import { PanelData } from '@grafana/data';
import { DataFieldProcessor, BoundsCalculator, CameraController } from './utils/ThreeSceneHelpers';
import { ThreeSceneObjectManager } from './utils/ThreeSceneObjectManager';
import {
  getInterpolationTargetMs,
  isQuaternionInterpolationActive,
  QuaternionInterpolationStore,
} from './utils/QuaternionInterpolation';

interface ThreeSceneProps {
  width: number;
  height: number;
  backgroundColor: string;
  showAxis: boolean;
  objects?: Shape[];
  data?: PanelData;
  ambientLightIntensity?: number;
  targetObjectId?: string;
  enableCameraControls?: boolean;
  cameraSettings?: CameraSettings;
  viewAngleScaling?: ViewAngleScalingSettings;
  pointLight?: PointLightSettings;
}

const POINT_LIGHT_DECAY_MAP: Record<string, number> = {
  none: 0,
  linear: 1,
  inverseSquare: 2,
};

export const ThreeScene: React.FC<ThreeSceneProps> = ({
  width,
  height,
  backgroundColor,
  showAxis,
  objects = [],
  data,
  ambientLightIntensity = 0.3,
  targetObjectId = 'origin',
  enableCameraControls = true,
  cameraSettings,
  viewAngleScaling,
  pointLight,
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
  const ambientLightRef = useRef<THREE.AmbientLight>();
  const pointLightRef = useRef<THREE.PointLight>();
  const [currentDistance, setCurrentDistance] = useState<number>(0);
  const [currentPosition, setCurrentPosition] = useState<THREE.Vector3>(new THREE.Vector3());
  const [interpolationStore] = useState(() => new QuaternionInterpolationStore());
  const interpolationConfigRef = useRef<Map<string, number>>(new Map());
  const interpolationTimeRef = useRef<{ timeRange: PanelData['timeRange'] | undefined; arrivedAt: number }>({
    timeRange: data?.timeRange,
    arrivedAt: Date.now(),
  });
  const lastInterpolationDataRef = useRef<PanelData | undefined>(data);

  if (lastInterpolationDataRef.current !== data) {
    lastInterpolationDataRef.current = data;
    interpolationTimeRef.current.arrivedAt = Date.now();
  }
  interpolationTimeRef.current.timeRange = data?.timeRange;
  const interpolationConfig = new Map<string, number>();
  objects.forEach((shape) => {
    if (shape.type === '3dmodel' && isQuaternionInterpolationActive(shape)) {
      interpolationConfig.set(shape.id, Math.max(0, Number(shape.interpMaxExtrapMs) || 0));
    }
  });
  interpolationConfigRef.current = interpolationConfig;

  // Helper classes
  const [dataProcessor] = useState(() => new DataFieldProcessor(data));
  const [boundsCalculator] = useState(() => new BoundsCalculator(dataProcessor));
  const [objectManager, setObjectManager] = useState<ThreeSceneObjectManager | null>(null);
  const [cameraController, setCameraController] = useState<CameraController | null>(null);

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

    const interpolationTarget = getInterpolationTargetMs(
      interpolationTimeRef.current.timeRange,
      interpolationTimeRef.current.arrivedAt,
      Date.now()
    );
    interpolationConfigRef.current.forEach((maxExtrapMs, id) => {
      const object = objectsRef.current.get(id);
      const quaternion = interpolationStore.sample(id, interpolationTarget, maxExtrapMs);
      if (object && quaternion) {
        object.quaternion.copy(quaternion);
      }
    });

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
  }, [objectManager, cameraSettings?.showPositionAndDistance, targetObjectId, interpolationStore]);

  // Update objects based on shape configuration
  const updateObjects = useCallback(async () => {
    if (!sceneRef.current || !objectManager) {return;}

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

  // Update ambient/point light intensity
  const updateLighting = useCallback(() => {
    // アンビエント光の強度更新
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = ambientLightIntensity;
    }

    // 点光源の有効/強度/減衰モードの更新
    if (pointLightRef.current) {
      pointLightRef.current.visible = pointLight?.enabled === 'on';
      pointLightRef.current.intensity = pointLight?.intensity ?? 1.0;
      pointLightRef.current.decay = POINT_LIGHT_DECAY_MAP[pointLight?.decayMode ?? 'none'];
    }
  }, [
    ambientLightIntensity,
    pointLight?.enabled,
    pointLight?.intensity,
    pointLight?.decayMode,
  ]);

  // Initialize scene on mount
  useEffect(() => {
    if (!mountRef.current || isInitialized || rendererRef.current) {
      return;
    }

    let objManager: ThreeSceneObjectManager | null = null;

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

      // アンビエント光の設定
      const ambientLight = new THREE.AmbientLight(0xffffff, ambientLightIntensity);
      scene.add(ambientLight);
      ambientLightRef.current = ambientLight;

      // 点光源の設定（有効状態・強度・減衰・位置は updateLighting / 専用effectで更新）
      const pointLightObj = new THREE.PointLight(0xffffff, 0, 0, 0);
      pointLightObj.visible = false;
      pointLightObj.castShadow = true;
      pointLightObj.shadow.mapSize.set(2048, 2048);
      pointLightObj.shadow.camera.near = 0.1;
      pointLightObj.shadow.camera.far = 1e8;
      pointLightObj.shadow.bias = -0.0005;
      scene.add(pointLightObj);
      pointLightRef.current = pointLightObj;

      // Initialize helper classes
      objManager = new ThreeSceneObjectManager(scene, dataProcessor, objectsRef, viewAngleScaling);
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
    
    // Store current refs for cleanup
    const currentMount = mountRef.current;
    
    return () => {
      const currentRenderer = rendererRef.current;
      const currentAnimation = animationIdRef.current;
      
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
      // ObjectManagerのクリーンアップ
      if (objManager) {
        objManager.dispose();
      }
      if (currentRenderer) {
        currentRenderer.dispose();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!sceneRef.current || !isInitialized) {return;}
    
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

  const objectsHash = JSON.stringify(objects.map(obj => ({
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
      unit: obj.unit,
      autoScale: obj.autoScale,
      scale: obj.scale,
      autoScaleFactor: obj.autoScaleFactor
    } : {})
  })));

  const interpolationHash = JSON.stringify(objects
    .filter((shape) => shape.type === '3dmodel')
    .map((shape) => [
      shape.id,
      shape.interpEnabled,
      shape.interpTimeField,
      shape.interpBufferSize,
      shape.quatX?.sourceType,
      shape.quatX?.value,
      shape.quatY?.sourceType,
      shape.quatY?.value,
      shape.quatZ?.sourceType,
      shape.quatZ?.value,
      shape.quatW?.sourceType,
      shape.quatW?.value,
    ]));

  useEffect(() => {
    const models = objects.filter((shape) => shape.type === '3dmodel');
    interpolationStore.retain(new Set(models.map((shape) => shape.id)));
    models.forEach((shape) => interpolationStore.update(shape, data?.series ?? [], interpolationTimeRef.current.arrivedAt));
  }, [data, interpolationHash, interpolationStore, objects]);

  // Update objects when configuration changes
  useEffect(() => {
    if (isInitialized && objectManager) {
      updateObjects();
    }
  }, [isInitialized, updateObjects, objectManager, objectsHash]);

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

  // Apply the camera position currently stored in cameraSettings to the live camera/controls.
  // Shared by the settings-change effect below and the on-canvas "Reset Camera" button
  // (previously resetting required a full page reload because nothing else invoked this logic).
  const applyCameraFromSettings = useCallback(() => {
    if (!cameraSettings || !cameraController || !cameraRef.current || !controlsRef.current) {
      return;
    }
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
  }, [
    targetObjectId,
    dataProcessor,
    cameraController,
    cameraSettings
  ]);

  // Handle manual camera position changes from UI fields
  useEffect(() => {
    applyCameraFromSettings();
  }, [applyCameraFromSettings]);

  const hasFieldDrivenCameraPosition =
    cameraSettings?.posX?.sourceType === 'field' ||
    cameraSettings?.posY?.sourceType === 'field' ||
    cameraSettings?.posZ?.sourceType === 'field';

  // Field-backed camera coordinates must be re-resolved whenever Grafana supplies new data.
  // Do not do this for constant-only cameras: a data refresh must not undo mouse movement.
  useEffect(() => {
    if (!data || !hasFieldDrivenCameraPosition) {
      return;
    }

    dataProcessor.setData(data);
    applyCameraFromSettings();
  }, [data, dataProcessor, hasFieldDrivenCameraPosition, applyCameraFromSettings]);

  // Handle point light position (const or data-field driven), including refresh on data changes
  useEffect(() => {
    if (!pointLightRef.current || !pointLight || pointLight.enabled !== 'on') {
      return;
    }
    const posX = dataProcessor.getLastDataFieldValue(pointLight.posX, 0);
    const posY = dataProcessor.getLastDataFieldValue(pointLight.posY, 0);
    const posZ = dataProcessor.getLastDataFieldValue(pointLight.posZ, 0);

    if (!isFinite(posX) || !isFinite(posY) || !isFinite(posZ)) {
      console.warn('Invalid point light position values:', { posX, posY, posZ });
      return;
    }

    pointLightRef.current.position.set(posX, posY, posZ);
  }, [
    pointLight?.enabled,
    pointLight?.posX?.sourceType,
    pointLight?.posX?.value,
    pointLight?.posY?.sourceType,
    pointLight?.posY?.value,
    pointLight?.posZ?.sourceType,
    pointLight?.posZ?.value,
    pointLight,
    dataProcessor,
    data,
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

  const showSaveCameraButton = cameraSettings?.showSaveCameraButton ?? true;
  const showResetCameraButton = cameraSettings?.showResetCameraButton ?? true;

  // Save the camera's current live position via the same message the editor's
  // "Get Current Camera Position" button sends; Rendezvous3DPanel's listener persists it.
  const handleSaveCamera = useCallback(() => {
    if (!cameraRef.current) {
      return;
    }
    const { x, y, z } = cameraRef.current.position;
    window.postMessage({
      type: 'camera-preset-update',
      posX: x.toString(),
      posY: y.toString(),
      posZ: z.toString(),
      preset: 'canvas-save',
    }, '*');
  }, []);

  // Re-apply the saved (or default) camera position without requiring a page reload.
  const handleResetCamera = useCallback(() => {
    applyCameraFromSettings();
  }, [applyCameraFromSettings]);

  const overlayButtonStyle: React.CSSProperties = {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 10px',
    fontSize: '12px',
    cursor: 'pointer',
  };

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
      {(showSaveCameraButton || showResetCameraButton) && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000,
            display: 'flex',
            gap: '6px',
            pointerEvents: 'auto',
          }}
        >
          {showSaveCameraButton && (
            <button onClick={handleSaveCamera} style={overlayButtonStyle}>Save Camera Position</button>
          )}
          {showResetCameraButton && (
            <button onClick={handleResetCamera} style={overlayButtonStyle}>Reset Camera</button>
          )}
        </div>
      )}
    </div>
  );
};
