import React from 'react';
import { StandardEditorProps } from '@grafana/data';
import { Button, HorizontalGroup } from '@grafana/ui';
import { SimpleOptions } from '../types';

interface CameraAxisEditorProps extends StandardEditorProps<any, any, SimpleOptions> {}

export const CameraAxisEditor: React.FC<CameraAxisEditorProps> = ({ context, onChange }) => {
  const handleAxisClick = (direction: string, axis: string) => {
    // Calculate camera position based on axis direction relative to target
    // Target座標を基準として、指定方向に固定距離100離れた位置にカメラを配置
    let cameraX = 0;
    let cameraY = 0;
    let cameraZ = 0;
    
    // Get current options for target calculation
    const currentOptions = context.options || {};
    const targetObjectId = currentOptions.targetObjectId || 'origin';
    
    // Get target object position
    let targetX = 0, targetY = 0, targetZ = 0;
    if (targetObjectId !== 'origin') {
      const objects = currentOptions.objects || [];
      const targetObject = objects.find((obj: any) => obj.id === targetObjectId);
      if (targetObject && 
          (targetObject.type === 'sphere' || targetObject.type === 'annotation' || targetObject.type === '3dmodel') &&
          targetObject.posX?.sourceType === 'const') {
        targetX = parseFloat(targetObject.posX.value) || 0;
        targetY = parseFloat(targetObject.posY.value) || 0;
        targetZ = parseFloat(targetObject.posZ.value) || 0;
      }
    }

    const fixedDistance = 100; // 固定距離

    // Set camera position based on axis direction relative to target
    // ターゲット座標 + 方向ベクトル * 固定距離
    switch (`${direction}${axis}`) {
      case '+X':
        cameraX = targetX + fixedDistance;
        cameraY = targetY;
        cameraZ = targetZ;
        break;
      case '-X':
        cameraX = targetX - fixedDistance;
        cameraY = targetY;
        cameraZ = targetZ;
        break;
      case '+Y':
        cameraX = targetX;
        cameraY = targetY + fixedDistance;
        cameraZ = targetZ;
        break;
      case '-Y':
        cameraX = targetX;
        cameraY = targetY - fixedDistance;
        cameraZ = targetZ;
        break;
      case '+Z':
        cameraX = targetX;
        cameraY = targetY;
        cameraZ = targetZ + fixedDistance;
        break;
      case '-Z':
        cameraX = targetX;
        cameraY = targetY;
        cameraZ = targetZ - fixedDistance;
        break;
    }

    // Send immediate camera move command (this will also trigger input field updates)
    const cameraMove = {
      type: 'camera-move-immediate',
      posX: cameraX,
      posY: cameraY,
      posZ: cameraZ,
      preset: `${direction}${axis}`,
      timestamp: Date.now()
    };

    // Send only the camera move command - input field update will be handled by ThreeScene
    window.postMessage(cameraMove, '*');

    // Also store the preset information for ThreeScene to process
    onChange({
      preset: `${direction}${axis}`,
      posX: cameraX,
      posY: cameraY,
      posZ: cameraZ,
      timestamp: Date.now()
    });
  };

  const handleCurrentCameraToInputs = () => {
    // Send message to request current camera position
    const requestEvent = {
      type: 'camera-current-position-request',
      timestamp: Date.now()
    };

    window.postMessage(requestEvent, '*');

    // Listen for the response
    const handleResponse = (event: MessageEvent) => {
      if (event.data && event.data.type === 'camera-current-position-response') {
        const { posX, posY, posZ } = event.data;
        
        // Send update event to set input fields
        const updateEvent = {
          type: 'camera-preset-update',
          posX: posX.toString(),
          posY: posY.toString(),
          posZ: posZ.toString(),
          preset: 'current'
        };
        
        window.postMessage(updateEvent, '*');
        
        // Also update through onChange
        onChange({
          preset: 'current',
          posX: posX,
          posY: posY,
          posZ: posZ,
          timestamp: Date.now()
        });
        
        // Remove event listener
        window.removeEventListener('message', handleResponse);
      }
    };

    window.addEventListener('message', handleResponse);
    
    // Clean up after timeout
    setTimeout(() => {
      window.removeEventListener('message', handleResponse);
    }, 5000);
  };

  return (
    <div>
      <div style={{ marginBottom: '8px', fontSize: '12px', color: '#666' }}>
        Click to automatically set camera position:
      </div>
      <HorizontalGroup spacing="xs">
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={() => handleAxisClick('+', 'X')}
        >
          +X
        </Button>
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={() => handleAxisClick('-', 'X')}
        >
          -X
        </Button>
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={() => handleAxisClick('+', 'Y')}
        >
          +Y
        </Button>
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={() => handleAxisClick('-', 'Y')}
        >
          -Y
        </Button>
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={() => handleAxisClick('+', 'Z')}
        >
          +Z
        </Button>
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={() => handleAxisClick('-', 'Z')}
        >
          -Z
        </Button>
      </HorizontalGroup>
      
      <div style={{ marginTop: '12px', marginBottom: '8px', fontSize: '12px', color: '#666' }}>
        Set current camera position to input fields:
      </div>
      <Button 
        size="sm" 
        variant="primary" 
        onClick={handleCurrentCameraToInputs}
        style={{ width: '100%' }}
      >
        Get Current Camera Position
      </Button>
    </div>
  );
};
