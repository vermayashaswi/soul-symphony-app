
// Type definitions for React Three Fiber
import * as THREE from 'three';

declare module '@react-three/fiber' {
  import { ReactNode, RefObject } from 'react';
  import * as THREE from 'three';
  
  interface ThreeElements {
    mesh: any;
    group: any;
    primitive: any;
    sphereGeometry: any;
    boxGeometry: any;
    meshStandardMaterial: any;
    meshBasicMaterial: any;
    lineBasicMaterial: any;
    ambientLight: any;
    pointLight: any;
    hemisphereLight: any;
    directionalLight: any;
    points: any;
    bufferGeometry: any;
    bufferAttribute: {
      attach: string;
      count: number;
      array: Float32Array | number[];
      itemSize: number;
    };
    pointsMaterial: {
      size?: number;
      color?: string | number;
      sizeAttenuation?: boolean;
      transparent?: boolean;
      opacity?: number;
    };
    fog: any;
  }

  export interface ThreeEvent<T> extends Event {
    object: THREE.Object3D;
    eventObject: THREE.Object3D;
    point: THREE.Vector3;
    distance: number;
    offsetX: number;
    offsetY: number;
  }
  
  export interface RootState {
    gl: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
    size: { width: number; height: number };
    viewport: { width: number; height: number; initialDpr: number; dpr: number; factor: number; distance: number };
    clock: THREE.Clock;
  }

  export function Canvas(props: {
    children: ReactNode;
    style?: React.CSSProperties;
    camera?: any;
    onPointerMissed?: (event: any) => void;
    gl?: any;
  }): JSX.Element;

  export function useFrame(callback: (state: RootState, delta: number) => void, priority?: number): void;
  export function useThree(): RootState;
  export function useLoader<T>(loader: new () => any, url: string | string[], onProgress?: (event: ProgressEvent) => void): T;
}

declare module '@react-three/drei' {
  import { ReactNode } from 'react';
  
  export function Text(props: any): JSX.Element;
  export function OrbitControls(props: any): JSX.Element;
}

declare namespace JSX {
  interface IntrinsicElements extends ThreeElements {
    group: any;
    mesh: any;
    primitive: any;
    sphereGeometry: any;
    boxGeometry: any;
    meshStandardMaterial: any;
    meshBasicMaterial: any;
    lineBasicMaterial: any;
    ambientLight: any;
    pointLight: any;
    hemisphereLight: any;
    directionalLight: any;
    points: any;
    bufferGeometry: any;
    bufferAttribute: {
      attach: string;
      count: number;
      array: Float32Array | number[];
      itemSize: number;
    };
    pointsMaterial: {
      size?: number;
      color?: string | number;
      sizeAttenuation?: boolean;
      transparent?: boolean;
      opacity?: number;
    };
    fog: any;
  }
}

// Extend Three.js types for better React Three Fiber integration
declare module 'three' {
  interface Object3D {
    userData?: any;
  }
  
  interface Material {
    transparent?: boolean;
    opacity?: number;
    depthWrite?: boolean;
    depthTest?: boolean;
  }
}
