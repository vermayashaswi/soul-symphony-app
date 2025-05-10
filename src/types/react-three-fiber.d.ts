
// Type definitions for React Three Fiber
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
    ambientLight: any;
    pointLight: any;
    hemisphereLight: any;
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
    ambientLight: any;
    pointLight: any;
    hemisphereLight: any;
  }
}

// Fix for ThreeElements interface
interface ThreeElements {
  group: any;
  mesh: any;
  primitive: any;
  sphereGeometry: any;
  boxGeometry: any;
  meshStandardMaterial: any;
  meshBasicMaterial: any;
  ambientLight: any;
  pointLight: any;
  hemisphereLight: any;
}
