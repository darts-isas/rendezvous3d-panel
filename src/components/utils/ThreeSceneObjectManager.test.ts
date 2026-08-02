import * as THREE from 'three';
import { ModelShape, SphereShape } from '../../types';
import { DataFieldProcessor } from './ThreeSceneHelpers';
import { ThreeSceneObjectManager } from './ThreeSceneObjectManager';

jest.mock('three/examples/jsm/loaders/GLTFLoader', () => ({
  GLTFLoader: class GLTFLoader {
    load() {}
  }
}));

const constant = (value: number) => ({ sourceType: 'const' as const, value: String(value) });

const viewAngleSettings = {
  targetAngularSize: 0.05,
  minSize: 0.000001,
  maxSize: 1_000_000
};

const makeManager = () => {
  const scene = new THREE.Scene();
  const objectsRef = { current: new Map<string, THREE.Object3D>() };
  const manager = new ThreeSceneObjectManager(
    scene,
    new DataFieldProcessor(),
    objectsRef as any,
    viewAngleSettings
  );
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 100);
  manager.setCamera(camera);

  return { manager, objectsRef };
};

const makeSphere = (overrides: Partial<SphereShape> = {}): SphereShape => ({
  id: 'sphere',
  type: 'sphere',
  name: 'Sphere',
  visible: true,
  color: '#ff0000',
  posX: constant(0),
  posY: constant(0),
  posZ: constant(0),
  autoRadius: 'on',
  radius: 3,
  ...overrides
});

const makeModel = (overrides: Partial<ModelShape> = {}): ModelShape => ({
  id: 'model',
  type: '3dmodel',
  name: 'Model',
  visible: true,
  url: '',
  posX: constant(0),
  posY: constant(0),
  posZ: constant(0),
  quatX: constant(0),
  quatY: constant(0),
  quatZ: constant(0),
  quatW: constant(1),
  autoScale: 'on',
  unit: 'km',
  ...overrides
});

const requiredSizeAt100 = 2 * 100 * Math.tan(viewAngleSettings.targetAngularSize / 2);

describe('ThreeSceneObjectManager object sizing', () => {
  it('switches a sphere cleanly between view-angle sizing and an explicit radius', () => {
    const { manager } = makeManager();
    const automatic = makeSphere();
    const sphere = manager.createSphere(automatic);
    manager.addObjectToScene(sphere, automatic.id);

    manager.updateViewAngleScaling();
    expect((sphere.geometry as THREE.SphereGeometry).parameters.radius).toBe(1);
    expect(2 * (sphere.geometry as THREE.SphereGeometry).parameters.radius * sphere.scale.x).toBeCloseTo(requiredSizeAt100);

    manager.updateObjects([{ ...automatic, autoRadius: 'off', radius: 3 }]);
    expect((sphere.geometry as THREE.SphereGeometry).parameters.radius).toBe(3);
    expect(sphere.scale.toArray()).toEqual([1, 1, 1]);

    manager.updateObjects([automatic]);
    manager.updateViewAngleScaling();
    expect((sphere.geometry as THREE.SphereGeometry).parameters.radius).toBe(1);
    expect(2 * (sphere.geometry as THREE.SphereGeometry).parameters.radius * sphere.scale.x).toBeCloseTo(requiredSizeAt100);
  });

  it('keeps default-cube auto scaling stable across model-unit changes', async () => {
    const { manager } = makeManager();
    const meters = makeModel({ unit: 'm', autoScale: 'off' });
    const cube = await manager.create3DModel(meters);
    const cubeSize = (2 * Math.sqrt(3)) / 3;
    manager.addObjectToScene(cube, meters.id);

    expect(cube.scale.toArray()).toEqual([0.001, 0.001, 0.001]);
    expect(cube.userData.originalSize).toBeCloseTo(cubeSize * 0.001);

    manager.updateObjects([{ ...meters, autoScale: 'on' }]);
    manager.updateViewAngleScaling();
    expect(cubeSize * cube.scale.x).toBeCloseTo(requiredSizeAt100);

    manager.updateObjects([{ ...meters, unit: 'km', autoScale: 'on' }]);
    manager.updateViewAngleScaling();
    expect(cubeSize * cube.scale.x).toBeCloseTo(requiredSizeAt100);

    manager.updateObjects([{ ...meters, unit: 'km', autoScale: 'off' }]);
    expect(cube.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('preserves hidden legacy scale fields for existing dashboards', async () => {
    const { manager } = makeManager();
    const legacySphereShape = makeSphere({ id: 'legacy-sphere', autoScaleFactor: 2 });
    const sphere = manager.createSphere(legacySphereShape);
    manager.addObjectToScene(sphere, legacySphereShape.id);

    manager.updateViewAngleScaling();
    expect(2 * (sphere.geometry as THREE.SphereGeometry).parameters.radius * sphere.scale.x).toBeCloseTo(requiredSizeAt100 * 2);

    const legacy = makeModel({ autoScale: 'off', scale: 3, autoScaleFactor: 2 });
    const cube = await manager.create3DModel(legacy);
    const cubeSize = (2 * Math.sqrt(3)) / 3;
    manager.addObjectToScene(cube, legacy.id);

    expect(cube.scale.toArray()).toEqual([3, 3, 3]);

    manager.updateObjects([{ ...legacy, autoScale: 'on' }]);
    manager.updateViewAngleScaling();
    expect(cubeSize * cube.scale.x).toBeCloseTo(requiredSizeAt100 * 2);
  });

  it('preserves transforms authored at the root of a loaded model', async () => {
    const { manager } = makeManager();
    const content = new THREE.Group();
    content.scale.setScalar(2);
    content.add(new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 1),
      new THREE.MeshLambertMaterial()
    ));

    (manager as any).gltfLoader.load = jest.fn((_url, onLoad) => {
      onLoad({ scene: content });
    });

    const model = await manager.create3DModel(makeModel({ url: 'model.glb', autoScale: 'off' }));
    const worldSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());

    expect(model).not.toBe(content);
    expect(content.scale.toArray()).toEqual([2, 2, 2]);
    expect(model.userData.nativeMaxDimension).toBeCloseTo(4);
    expect(worldSize.x).toBeCloseTo(4);
  });
});
