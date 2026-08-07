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

describe('ThreeSceneObjectManager brightness', () => {
  const meshMaterial = (object: THREE.Object3D): THREE.MeshLambertMaterial => {
    let found: THREE.MeshLambertMaterial | undefined;
    object.traverse((child) => {
      if (child instanceof THREE.Mesh && !found) {
        found = child.material as THREE.MeshLambertMaterial;
      }
    });
    if (!found) {throw new Error('no mesh material found');}
    return found;
  };

  const expectColorCloseTo = (actual: THREE.Color, expected: THREE.Color) => {
    expect(actual.r).toBeCloseTo(expected.r);
    expect(actual.g).toBeCloseTo(expected.g);
    expect(actual.b).toBeCloseTo(expected.b);
  };

  it('darkens a sphere color by a const brightness, without touching opacity/transparency', () => {
    const { manager } = makeManager();
    const sphere = manager.createSphere(makeSphere({ brightness: constant(0.5) }));
    const material = meshMaterial(sphere);

    expectColorCloseTo(material.color, new THREE.Color('#ff0000').multiplyScalar(0.5));
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
  });

  it('defaults an undefined brightness to unchanged (1)', () => {
    const { manager } = makeManager();
    const sphere = manager.createSphere(makeSphere());

    expectColorCloseTo(meshMaterial(sphere).color, new THREE.Color('#ff0000'));
  });

  it('clamps out-of-range const brightness values', () => {
    const { manager } = makeManager();

    const over = manager.createSphere(makeSphere({ id: 'over', brightness: constant(2) }));
    expectColorCloseTo(meshMaterial(over).color, new THREE.Color('#ff0000'));

    const under = manager.createSphere(makeSphere({ id: 'under', brightness: constant(-1) }));
    expectColorCloseTo(meshMaterial(under).color, new THREE.Color(0, 0, 0));
  });

  it('reflects a brightness change through updateObjects for an existing sphere', () => {
    const { manager } = makeManager();
    const shape = makeSphere({ brightness: constant(1) });
    const sphere = manager.createSphere(shape);
    manager.addObjectToScene(sphere, shape.id);

    manager.updateObjects([{ ...shape, brightness: constant(0.25) }]);

    const material = meshMaterial(sphere);
    expectColorCloseTo(material.color, new THREE.Color('#ff0000').multiplyScalar(0.25));
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
  });

  it('rebaselines against the new color when both color and brightness change via updateObjects', () => {
    const { manager } = makeManager();
    const shape = makeSphere({ color: '#ff0000', brightness: constant(0.5) });
    const sphere = manager.createSphere(shape);
    manager.addObjectToScene(sphere, shape.id);

    // Same brightness, different color: a stale cached base color would incorrectly keep
    // darkening the old red instead of the new green.
    manager.updateObjects([{ ...shape, color: '#00ff00', brightness: constant(0.5) }]);

    expectColorCloseTo(meshMaterial(sphere).color, new THREE.Color('#00ff00').multiplyScalar(0.5));
  });

  it('darkens the default cube color without changing its authored translucency', async () => {
    const { manager } = makeManager();
    const cube = await manager.create3DModel(makeModel({ brightness: constant(0.5) }));
    const material = meshMaterial(cube);

    expectColorCloseTo(material.color, new THREE.Color(0x888888).multiplyScalar(0.5));
    // Default cube material is authored at opacity 0.8 / transparent true; brightness must
    // not touch either.
    expect(material.opacity).toBeCloseTo(0.8);
    expect(material.transparent).toBe(true);
  });

  it('clones materials so brightness does not leak across models sharing a material instance', async () => {
    const { manager } = makeManager();
    const sharedMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });

    const makeContent = () => {
      const content = new THREE.Group();
      content.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sharedMaterial));
      return content;
    };

    (manager as any).gltfLoader.load = jest.fn((_url: string, onLoad: (gltf: any) => void) => {
      onLoad({ scene: makeContent() });
    });

    const brightModel = await manager.create3DModel(makeModel({ id: 'bright', url: 'model.glb', brightness: constant(1) }));
    const darkModel = await manager.create3DModel(makeModel({ id: 'dark', url: 'model.glb', brightness: constant(0.2) }));

    expectColorCloseTo(meshMaterial(brightModel).color, new THREE.Color(0xffffff));
    expectColorCloseTo(meshMaterial(darkModel).color, new THREE.Color(0xffffff).multiplyScalar(0.2));
    // The original (shared) material instance itself must be untouched.
    expectColorCloseTo(sharedMaterial.color, new THREE.Color(0xffffff));
  });
});
