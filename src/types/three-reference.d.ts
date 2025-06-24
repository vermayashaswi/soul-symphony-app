
// Three.js type reference extensions for React Three Fiber compatibility
import * as THREE from 'three';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Ensure Three.js objects work with React Three Fiber
      primitive: any;
      group: any;
      mesh: any;
      lineBasicMaterial: any;
      bufferGeometry: any;
      sphereGeometry: any;
      boxGeometry: any;
      ambientLight: any;
      directionalLight: any;
      pointLight: any;
    }
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
  
  // Ensure compatibility with newer Three.js versions
  interface BufferGeometry {
    setFromPoints(points: Vector3[]): this;
  }
  
  interface QuadraticBezierCurve3 {
    getPoints(divisions?: number): Vector3[];
  }
}

export {};
