import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { PanelData } from '@grafana/data';
import * as THREE from 'three';
import { CameraSettings } from '../types';
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

jest.mock('./utils/ThreeSceneObjectManager', () => ({
  ThreeSceneObjectManager: class ThreeSceneObjectManager {
    setCamera = jest.fn();
    updateViewAngleScaling = jest.fn();
    updateGlobalViewAngleSettings = jest.fn();
    removeObjectsFromScene = jest.fn();
    updateObjects = jest.fn();
    addObjectToScene = jest.fn();
    dispose = jest.fn();
  },
}));

type MockRenderer = {
  lastCamera?: THREE.PerspectiveCamera;
};

const EMPTY_OBJECTS: never[] = [];

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
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
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
});
