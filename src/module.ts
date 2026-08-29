import { PanelPlugin } from '@grafana/data';
import { Rendezvous3DPanelOptions } from './types';
import { Rendezvous3DPanel } from './components/Rendezvous3DPanel';
import { ObjectsEditor } from './components/ObjectsEditor';
import { TargetObjectEditor } from './components/TargetObjectEditor';
import { CameraAxisEditor } from './components/CameraAxisEditor';
import ViewAngleScalingEditor from './components/ViewAngleScalingEditor';
import { KeyParamsEditor } from './components/KeyParamsEditor';

export const plugin = new PanelPlugin<Rendezvous3DPanelOptions>(Rendezvous3DPanel).setPanelOptions((builder) => {
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
    .addRadio({
      path: 'pointLight.enabled',
      name: 'Point Light',
      description: 'Enable a single point light source in the scene, radiating from the configured position.',
      defaultValue: 'off',
      settings: {
        options: [
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off' },
        ],
      },
      category: ['Lighting Settings'],
    })
    .addNumberInput({
      path: 'pointLight.intensity',
      name: 'Point Light Intensity',
      description: 'Light intensity.',
      defaultValue: 1.0,
      settings: {
        min: 0,
      },
      category: ['Lighting Settings'],
      showIf: (config: Rendezvous3DPanelOptions) => config.pointLight?.enabled === 'on',
    })
    .addRadio({
      path: 'pointLight.posX.sourceType',
      name: 'Light X Position Source',
      defaultValue: 'const',
      settings: {
        options: [
          { value: 'const', label: 'Constant' },
          { value: 'field', label: 'Field' },
        ],
      },
      category: ['Lighting Settings'],
      showIf: (config: Rendezvous3DPanelOptions) => config.pointLight?.enabled === 'on',
    })
    .addNumberInput({
      path: 'pointLight.posX.value',
      name: 'Light X Position',
      defaultValue: 0,
      category: ['Lighting Settings'],
      showIf: (config: Rendezvous3DPanelOptions) =>
        config.pointLight?.enabled === 'on' && config.pointLight?.posX?.sourceType === 'const',
    })
    .addTextInput({
      path: 'pointLight.posX.value',
      name: 'Light X Position Field Name',
      defaultValue: '',
      category: ['Lighting Settings'],
      showIf: (config: Rendezvous3DPanelOptions) =>
        config.pointLight?.enabled === 'on' && config.pointLight?.posX?.sourceType === 'field',
    })
    .addRadio({
      path: 'pointLight.posY.sourceType',
      name: 'Light Y Position Source',
      defaultValue: 'const',
      settings: {
        options: [
          { value: 'const', label: 'Constant' },
          { value: 'field', label: 'Field' },
        ],
      },
      category: ['Lighting Settings'],
      showIf: (config: Rendezvous3DPanelOptions) => config.pointLight?.enabled === 'on',
    })
    .addNumberInput({
      path: 'pointLight.posY.value',
      name: 'Light Y Position',
      defaultValue: 0,
      category: ['Lighting Settings'],
      showIf: (config: Rendezvous3DPanelOptions) =>
        config.pointLight?.enabled === 'on' && config.pointLight?.posY?.sourceType === 'const',
    })
    .addTextInput({
      path: 'pointLight.posY.value',
      name: 'Light Y Position Field Name',
      defaultValue: '',
      category: ['Lighting Settings'],
      showIf: (config: Rendezvous3DPanelOptions) =>
        config.pointLight?.enabled === 'on' && config.pointLight?.posY?.sourceType === 'field',
    })
    .addRadio({
      path: 'pointLight.posZ.sourceType',
      name: 'Light Z Position Source',
      defaultValue: 'const',
      settings: {
        options: [
          { value: 'const', label: 'Constant' },
          { value: 'field', label: 'Field' },
        ],
      },
      category: ['Lighting Settings'],
      showIf: (config: Rendezvous3DPanelOptions) => config.pointLight?.enabled === 'on',
    })
    .addNumberInput({
      path: 'pointLight.posZ.value',
      name: 'Light Z Position',
      defaultValue: 0,
      category: ['Lighting Settings'],
      showIf: (config: Rendezvous3DPanelOptions) =>
        config.pointLight?.enabled === 'on' && config.pointLight?.posZ?.sourceType === 'const',
    })
    .addTextInput({
      path: 'pointLight.posZ.value',
      name: 'Light Z Position Field Name',
      defaultValue: '',
      category: ['Lighting Settings'],
      showIf: (config: Rendezvous3DPanelOptions) =>
        config.pointLight?.enabled === 'on' && config.pointLight?.posZ?.sourceType === 'field',
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
    .addBooleanSwitch({
      path: 'camera.showSaveCameraButton',
      name: 'Show "Save Camera Position" Button',
      description: 'Show an on-canvas button that saves the current camera position',
      defaultValue: true,
      category: ['Camera Settings'],
    })
    .addBooleanSwitch({
      path: 'camera.showResetCameraButton',
      name: 'Show "Reset Camera" Button',
      description: 'Show an on-canvas button that returns the camera to the saved position',
      defaultValue: true,
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
      showIf: (config: Rendezvous3DPanelOptions) => config.camera?.posX?.sourceType === 'const',
    })
    .addTextInput({
      path: 'camera.posX.value',
      name: 'X Position Field Name',
      defaultValue: '',
      category: ['Camera Settings'],
      showIf: (config: Rendezvous3DPanelOptions) => config.camera?.posX?.sourceType === 'field',
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
      showIf: (config: Rendezvous3DPanelOptions) => config.camera?.posY?.sourceType === 'const',
    })
    .addTextInput({
      path: 'camera.posY.value',
      name: 'Y Position Field Name',
      defaultValue: '',
      category: ['Camera Settings'],
      showIf: (config: Rendezvous3DPanelOptions) => config.camera?.posY?.sourceType === 'field',
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
      showIf: (config: Rendezvous3DPanelOptions) => config.camera?.posZ?.sourceType === 'const',
    })
    .addTextInput({
      path: 'camera.posZ.value',
      name: 'Z Position Field Name',
      defaultValue: '',
      category: ['Camera Settings'],
      showIf: (config: Rendezvous3DPanelOptions) => config.camera?.posZ?.sourceType === 'field',
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
    })

    // Key Parameters — overlays a fixed-format text list of data values on top of the
    // scene. Global style settings first, the per-parameter list editor last.
    .addNumberInput({
      path: 'keyParamFontSize',
      name: 'Font Size',
      description: 'Font size of the key parameter overlay, in pixels',
      defaultValue: 14,
      category: ['Key Parameters'],
    })
    .addRadio({
      path: 'keyParamVerticalPosition',
      name: 'Vertical Position',
      settings: {
        options: [
          { value: 'top', label: 'Top' },
          { value: 'bottom', label: 'Bottom' },
        ],
      },
      defaultValue: 'top',
      category: ['Key Parameters'],
    })
    .addRadio({
      path: 'keyParamHorizontalPosition',
      name: 'Horizontal Position',
      settings: {
        options: [
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
        ],
      },
      defaultValue: 'left',
      category: ['Key Parameters'],
    })
    .addRadio({
      path: 'keyParamSeparator',
      name: 'Separator',
      description: "Text placed between each parameter's name and value",
      settings: {
        options: [
          { value: 'colon', label: ':' },
          { value: 'equal', label: '=' },
          { value: 'space', label: '(space)' },
        ],
      },
      defaultValue: 'colon',
      category: ['Key Parameters'],
    })
    .addNumberInput({
      path: 'keyParamValueWidth',
      name: 'Value Width',
      description: 'Fixed width of the value column, in characters. Keeps the overlay size constant regardless of the value.',
      defaultValue: 8,
      category: ['Key Parameters'],
    })
    .addColorPicker({
      path: 'keyParamTextColor',
      name: 'Text Color',
      defaultValue: '#ffffff',
      category: ['Key Parameters'],
    })
    .addBooleanSwitch({
      path: 'keyParamBackground',
      name: 'Background',
      description: 'Show a background behind the overlay text',
      defaultValue: true,
      category: ['Key Parameters'],
    })
    .addColorPicker({
      path: 'keyParamBackgroundColor',
      name: 'Background Color',
      defaultValue: '#808080',
      category: ['Key Parameters'],
      showIf: (config: Rendezvous3DPanelOptions) => config.keyParamBackground === true,
    })
    .addSliderInput({
      path: 'keyParamBackgroundOpacity',
      name: 'Background Opacity',
      settings: { min: 0, max: 1, step: 0.05 },
      defaultValue: 0.25,
      category: ['Key Parameters'],
      showIf: (config: Rendezvous3DPanelOptions) => config.keyParamBackground === true,
    })
    .addRadio({
      path: 'keyParamShape',
      name: 'Shape',
      settings: {
        options: [
          { value: 'rect', label: 'Rectangle' },
          { value: 'rounded', label: 'Rounded' },
        ],
      },
      defaultValue: 'rounded',
      category: ['Key Parameters'],
    })
    .addBooleanSwitch({
      path: 'keyParamBorder',
      name: 'Border',
      defaultValue: true,
      category: ['Key Parameters'],
    })
    .addColorPicker({
      path: 'keyParamBorderColor',
      name: 'Border Color',
      defaultValue: '#ffffff',
      category: ['Key Parameters'],
      showIf: (config: Rendezvous3DPanelOptions) => config.keyParamBorder === true,
    })
    .addCustomEditor({
      id: 'keyParams',
      path: 'keyParams',
      name: 'Key Parameters',
      description: 'Add and configure the key parameters shown over the model',
      editor: KeyParamsEditor,
      defaultValue: [],
      category: ['Key Parameters'],
    });
});
