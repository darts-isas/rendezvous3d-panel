import React, { useEffect } from 'react';
import { PanelProps } from '@grafana/data';
import { SimpleOptions } from '../types';
import { css } from '@emotion/css';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { ThreeScene } from './ThreeScene';

interface Props extends PanelProps<SimpleOptions> {}

const getStyles = () => {
  return {
    wrapper: css`
      font-family: Open Sans;
      position: relative;
    `,
    svg: css`
      position: absolute;
      top: 0;
      left: 0;
    `,
    textBox: css`
      position: absolute;
      bottom: 0;
      left: 0;
      padding: 10px;
    `,
  };
};

export const SimplePanel: React.FC<Props> = ({ options, data, width, height, fieldConfig, id, onOptionsChange }) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  // データ変更を監視
  useEffect(() => {
    // Data change monitoring for display updates
  }, [data]);

  // Listen for camera preset updates
  useEffect(() => {
    const handlePresetUpdate = (event: MessageEvent) => {
      if (event.data && event.data.type === 'camera-preset-update') {
        const { posX, posY, posZ } = event.data;
        
        // Update camera options with new preset values
        const updatedOptions: SimpleOptions = {
          ...options,
          camera: {
            enableControls: 'on',
            showPositionAndDistance: 'off',
            ...options.camera,
            posX: {
              sourceType: 'const' as const,
              value: posX
            },
            posY: {
              sourceType: 'const' as const,
              value: posY
            },
            posZ: {
              sourceType: 'const' as const,
              value: posZ
            },
            // Update axisTrigger to prevent duplicate processing
            axisTrigger: options.camera?.axisTrigger
          }
        };
        
        // Update the panel options
        onOptionsChange(updatedOptions);
      }
    };

    window.addEventListener('message', handlePresetUpdate);
    
    return () => {
      window.removeEventListener('message', handlePresetUpdate);
    };
  }, [options, onOptionsChange]);

  // If no data and no configured shapes, show a helpful message
  if (data.series.length === 0 && (options.objects || []).length === 0) {
    return (
      <div className={styles.wrapper}>
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: theme.colors.text.secondary 
        }}>
          <p>No data or objects configured. Please:</p>
          <ul style={{ textAlign: 'left', display: 'inline-block' }}>
            <li>Add objects in the "Objects" tab in panel settings, or</li>
            <li>Connect a data source to visualize data</li>
          </ul>
          <p style={{ fontSize: '12px', marginTop: '10px' }}>
            Available object types: Sphere, 3D Model, Polyline, Annotation
          </p>
        </div>
      </div>
    );
  }

  // Show data available message if we have data but no objects
  if (data.series.length > 0 && (options.objects || []).length === 0) {
    return (
      <div className={styles.wrapper}>
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: theme.colors.text.secondary 
        }}>
          <p>Data source connected ({data.series.length} series available)</p>
          <p>Please add objects in the "Objects" tab to visualize the data.</p>
          <p style={{ fontSize: '12px', marginTop: '10px' }}>
            Check browser console for detailed field information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.wrapper}
      style={{
        width: width,
        height: height,
      }}
    >
      <ThreeScene
        width={width}
        height={height}
        backgroundColor={options.backgroundColor || '#000000'}
        showAxis={(options.showAxis || 'on') === 'on'}
        objects={options.objects || []}
        data={data}
        environmentMapIntensity={options.environmentMapIntensity || 0.6}
        directionalLightIntensity={options.directionalLightIntensity || 0.4}
        ambientLightIntensity={options.ambientLightIntensity || 0.3}
        targetObjectId={options.targetObjectId || 'origin'}
        enableCameraControls={(options.camera?.enableControls || 'on') === 'on'}
        cameraSettings={options.camera}
        viewAngleScaling={options.viewAngleScaling}
      />
    </div>
  );
};
