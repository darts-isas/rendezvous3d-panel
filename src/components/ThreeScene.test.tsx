import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { FieldType, PanelData } from '@grafana/data';
import * as THREE from 'three';
import { CameraSettings, ModelShape } from '../types';
import { ThreeScene } from './ThreeScene';

jest.mock('three', () => {
  const actual = jest.requireActual('three');

  class WebGLRenderer {
    static instances: WebGLRenderer[] = [];

    domElement = document.createElement('canvas');
    shadowMap = { enabled: false, type: null };
    toneMapping = actual.NoToneMapping;
    toneMappingExposure = 1;
    lastCamera?: THREE.PerspectiveCamera;

    setSize = jest.fn();
    render = jest.fn((_scene: THREE.Scene, camera: THREE.PerspectiveCamera) => {
      this.lastCamera = camera;
    });
    dispose = jest.fn();

    constructor() {
      WebGLRenderer.instances.push(this);
    }
  }

  return {
    ...actual,
    WebGLRenderer,
  };
});

jest.mock('three/examples/jsm/controls/OrbitControls', () => {
  const { Vector3 } = jest.requireActual('three');

  return {
    OrbitControls: class OrbitControls {
      enabled = true;
      enableDamping = false;
      dampingFactor = 0;
      target = new Vector3();
      update = jest.fn();
    },
  };
});

jest.mock('./utils/ThreeSceneObjectManager', () => {
  const { Group } = jest.requireActual('three');

  return { ThreeSceneObjectManager: class ThreeSceneObjectManager {
    static objects = new Map<string, THREE.Object3D>();
    private objectsRef: { current: Map<string, THREE.Object3D> };

    constructor(_scene: unknown, _dataProcessor: unknown, objectsRef: { current: Map<string, THREE.Object3D> }) {
      this.objectsRef = objectsRef;
    }

    setCamera = jest.fn();
    updateViewAngleScaling = jest.fn();
    updateGlobalViewAngleSettings = jest.fn();
    removeObjectsFromScene = jest.fn();
    updateObjects = jest.fn();
    create3DModel = jest.fn(async () => new Group());
    addObjectToScene = jest.fn((object: THREE.Object3D, id: string) => {
      this.objectsRef.current.set(id, object);
      ThreeSceneObjectManager.objects.set(id, object);
    });
    dispose = jest.fn();
  } };
});

type MockRenderer = {
  lastCamera?: THREE.PerspectiveCamera;
};

const EMPTY_OBJECTS: never[] = [];
let animationCallbacks: FrameRequestCallback[] = [];

const makeData = (values: Record<string, number[]>): PanelData =>
  ({
    series: [
      {
        name: 'camera',
        refId: 'A',
        fields: Object.entries(values).map(([name, fieldValues]) => ({
          name,
          values: {
            length: fieldValues.length,
            toArray: () => fieldValues,
          },
        })),
      },
    ],
  } as PanelData);

const renderScene = (data: PanelData, cameraSettings: CameraSettings) => (
  <ThreeScene
    width={640}
    height={480}
    backgroundColor="#000000"
    showAxis={false}
    objects={EMPTY_OBJECTS}
    data={data}
    cameraSettings={cameraSettings}
  />
);

const getCamera = (): THREE.PerspectiveCamera => {
  const Renderer = THREE.WebGLRenderer as unknown as { instances: MockRenderer[] };
  const camera = Renderer.instances[0]?.lastCamera;
  if (!camera) {
    throw new Error('The test renderer has not received a camera');
  }
  return camera;
};

describe('ThreeScene camera position data binding', () => {
  beforeEach(() => {
    (THREE.WebGLRenderer as unknown as { instances: MockRenderer[] }).instances = [];
    const Manager = jest.requireMock('./utils/ThreeSceneObjectManager').ThreeSceneObjectManager;
    Manager.objects.clear();
    animationCallbacks = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationCallbacks.push(callback);
      return animationCallbacks.length;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the latest field values and updates them when panel data changes', async () => {
    const settings: CameraSettings = {
      posX: { sourceType: 'field', value: 'x' },
      posY: { sourceType: 'field', value: 'y' },
      posZ: { sourceType: 'field', value: 'z' },
      enableControls: 'on',
      showPositionAndDistance: 'off',
    };
    const initialData = makeData({ x: [1, 2], y: [3, 4], z: [5, 6] });
    const { rerender } = render(renderScene(initialData, settings));

    await waitFor(() => {
      expect(getCamera().position.toArray()).toEqual([2, 4, 6]);
    });

    rerender(renderScene(makeData({ x: [10, 20], y: [30, 40], z: [50, 60] }), settings));

    await waitFor(() => {
      expect(getCamera().position.toArray()).toEqual([20, 40, 60]);
    });
  });

  it('refreshes field axes while preserving configured constant axes', async () => {
    const settings: CameraSettings = {
      posX: { sourceType: 'field', value: 'x' },
      posY: { sourceType: 'const', value: '25' },
      posZ: { sourceType: 'const', value: '50' },
      enableControls: 'on',
      showPositionAndDistance: 'off',
    };
    const { rerender } = render(renderScene(makeData({ x: [1] }), settings));

    await waitFor(() => {
      expect(getCamera().position.toArray()).toEqual([1, 25, 50]);
    });

    rerender(renderScene(makeData({ x: [9] }), settings));

    await waitFor(() => {
      expect(getCamera().position.toArray()).toEqual([9, 25, 50]);
    });
  });

  it('does not reset a manually moved constant-only camera on data refresh', async () => {
    const settings: CameraSettings = {
      posX: { sourceType: 'const', value: '1' },
      posY: { sourceType: 'const', value: '2' },
      posZ: { sourceType: 'const', value: '3' },
      enableControls: 'on',
      showPositionAndDistance: 'off',
    };
    const { rerender } = render(renderScene(makeData({ telemetry: [1] }), settings));

    await waitFor(() => {
      expect(getCamera().position.toArray()).toEqual([1, 2, 3]);
    });

    getCamera().position.set(9, 8, 7);
    rerender(renderScene(makeData({ telemetry: [2] }), settings));

    await waitFor(() => {
      expect(getCamera().position.toArray()).toEqual([9, 8, 7]);
    });
  });

  it('applies a per-model interpolated quaternion in the animation loop', async () => {
    const field = (value: string) => ({ sourceType: 'field' as const, value });
    const constant = (value: string) => ({ sourceType: 'const' as const, value });
    const model: ModelShape = {
      id: 'interpolated-model',
      type: '3dmodel',
      name: 'Interpolated model',
      visible: true,
      url: '',
      posX: constant('0'),
      posY: constant('0'),
      posZ: constant('0'),
      quatX: field('x'),
      quatY: field('y'),
      quatZ: field('z'),
      quatW: field('w'),
      interpEnabled: true,
      interpTimeField: '',
      interpBufferSize: 2,
      interpMaxExtrapMs: 5000,
      autoScale: 'off',
      unit: 'km',
    };
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const interpolationData = {
      series: [{
        name: 'attitude',
        fields: [
          { name: 'time', type: FieldType.time, values: [0, 1000], config: {} },
          { name: 'x', type: FieldType.number, values: [q0.x, q1.x], config: {} },
          { name: 'y', type: FieldType.number, values: [q0.y, q1.y], config: {} },
          { name: 'z', type: FieldType.number, values: [q0.z, q1.z], config: {} },
          { name: 'w', type: FieldType.number, values: [q0.w, q1.w], config: {} },
        ],
        length: 2,
      }],
      timeRange: {
        raw: { from: '1970-01-01T00:00:00.000Z', to: '1970-01-01T00:00:00.500Z' },
        from: { valueOf: () => 0 },
        to: { valueOf: () => 500 },
      },
    } as unknown as PanelData;

    render(
      <ThreeScene
        width={640}
        height={480}
        backgroundColor="#000000"
        showAxis={false}
        objects={[model]}
        data={interpolationData}
      />
    );

    const Manager = jest.requireMock('./utils/ThreeSceneObjectManager').ThreeSceneObjectManager;
    await waitFor(() => expect(Manager.objects.has(model.id)).toBe(true));

    const pendingCallbacks = animationCallbacks.splice(0);
    pendingCallbacks.forEach((callback) => callback(0));

    const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
    expect(Manager.objects.get(model.id).quaternion.angleTo(expected)).toBeLessThan(1e-6);
  });
});
