import { PanelPlugin } from '@grafana/data';
import { SimpleOptions } from './types';
import { SimplePanel } from './components/SimplePanel';
import { ObjectsEditor } from './components/ObjectsEditor';
import { TargetObjectEditor } from './components/TargetObjectEditor';
import { CameraAxisEditor } from './components/CameraAxisEditor';
import ViewAngleScalingEditor from './components/ViewAngleScalingEditor';

export const plugin = new PanelPlugin<SimpleOptions>(SimplePanel).setPanelOptions((builder) => {
  return builder
    // Basic Settings
    .addRadio({
      path: 'showAxis',
      name: 'Show Axis',
      defaultValue: 'on',
      settings: {
        options: [
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off' },
        ],
      },
      category: ['Basic Settings'],
    })
    .addColorPicker({
      path: 'backgroundColor',
      name: 'Background Color',
      defaultValue: '#000000',
      category: ['Basic Settings'],
    })

    // Lighting Settings
    .addSliderInput({
      path: 'environmentMapIntensity',
      name: 'Environment Map Intensity',
      description: 'Controls the strength of the gradient environment lighting',
      defaultValue: 0.6,
      settings: {
        min: 0.05,
        max: 2,
        step: 0.05,
      },
      category: ['Lighting Settings'],
    })
    .addSliderInput({
      path: 'directionalLightIntensity',
      name: 'Directional Light Intensity',
      description: 'Controls the strength of the directional light source',
      defaultValue: 0.4,
      settings: {
        min: 0,
        max: 2,
        step: 0.1,
      },
      category: ['Lighting Settings'],
    })
    .addSliderInput({
      path: 'ambientLightIntensity',
      name: 'Ambient Light Intensity',
      description: 'Controls the strength of the ambient light source',
      defaultValue: 0.3,
      settings: {
        min: 0,
        max: 2,
        step: 0.1,
      },
      category: ['Lighting Settings'],
    })

    // Auto Scaling Factors Settings
    .addCustomEditor({
      id: 'viewAngleScaling',
      path: 'viewAngleScaling',
      name: 'View Angle Scaling',
      description: 'View angle scaling method settings applied when object scaling is set to Auto',
      editor: ViewAngleScalingEditor,
      defaultValue: {
        targetAngularSize: 0.05,
        minSize: 0.1,
        maxSize: 14720000000.0
      },
      category: ['Auto Scaling Factors'],
    })

    // Camera Settings
    .addCustomEditor({
      id: 'targetObject',
      path: 'targetObjectId',
      name: 'Target Object',
      description: 'Object to focus the camera on',
      editor: TargetObjectEditor,
      defaultValue: 'origin',
      category: ['Camera Settings'],
    })
    .addCustomEditor({
      id: 'cameraAxisButtons',
      path: 'camera.axisTrigger',
      name: 'Camera Direction Presets',
      description: 'Click buttons to automatically set camera direction',
      editor: CameraAxisEditor,
      defaultValue: null,
      category: ['Camera Settings'],
    })
    .addRadio({
      path: 'camera.posX.sourceType',
      name: 'X Position Source',
      defaultValue: 'const',
      settings: {
        options: [
          { value: 'const', label: 'Constant' },
          { value: 'field', label: 'Field' },
        ],
      },
      category: ['Camera Settings'],
    })
    .addNumberInput({
      path: 'camera.posX.value',
      name: 'X Position',
      defaultValue: 100,
      category: ['Camera Settings'],
      showIf: (config: SimpleOptions) => config.camera?.posX?.sourceType === 'const',
    })
    .addTextInput({
      path: 'camera.posX.value',
      name: 'X Position Field Name',
      defaultValue: '',
      category: ['Camera Settings'],
      showIf: (config: SimpleOptions) => config.camera?.posX?.sourceType === 'field',
    })
    .addRadio({
      path: 'camera.posY.sourceType',
      name: 'Y Position Source',
      defaultValue: 'const',
      settings: {
        options: [
          { value: 'const', label: 'Constant' },
          { value: 'field', label: 'Field' },
        ],
      },
      category: ['Camera Settings'],
    })
    .addNumberInput({
      path: 'camera.posY.value',
      name: 'Y Position',
      defaultValue: 100,
      category: ['Camera Settings'],
      showIf: (config: SimpleOptions) => config.camera?.posY?.sourceType === 'const',
    })
    .addTextInput({
      path: 'camera.posY.value',
      name: 'Y Position Field Name',
      defaultValue: '',
      category: ['Camera Settings'],
      showIf: (config: SimpleOptions) => config.camera?.posY?.sourceType === 'field',
    })
    .addRadio({
      path: 'camera.posZ.sourceType',
      name: 'Z Position Source',
      defaultValue: 'const',
      settings: {
        options: [
          { value: 'const', label: 'Constant' },
          { value: 'field', label: 'Field' },
        ],
      },
      category: ['Camera Settings'],
    })
    .addNumberInput({
      path: 'camera.posZ.value',
      name: 'Z Position',
      defaultValue: 100,
      category: ['Camera Settings'],
      showIf: (config: SimpleOptions) => config.camera?.posZ?.sourceType === 'const',
    })
    .addTextInput({
      path: 'camera.posZ.value',
      name: 'Z Position Field Name',
      defaultValue: '',
      category: ['Camera Settings'],
      showIf: (config: SimpleOptions) => config.camera?.posZ?.sourceType === 'field',
    })
    .addRadio({
      path: 'camera.enableControls',
      name: 'Enable Camera Controls',
      defaultValue: 'on',
      settings: {
        options: [
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off' },
        ],
      },
      category: ['Camera Settings'],
    })
    .addRadio({
      path: 'camera.showPositionAndDistance',
      name: 'Show Position and Distance',
      description: 'Display camera position (XYZ) and distance to target object',
      defaultValue: 'off',
      settings: {
        options: [
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off' },
        ],
      },
      category: ['Camera Settings'],
    })

    // Objects
    .addCustomEditor({
      id: 'objects',
      path: 'objects',
      name: 'Objects',
      description: 'Add and configure 3D objects in the scene',
      editor: ObjectsEditor,
      defaultValue: [],
      category: ['Objects'],
    });
});
