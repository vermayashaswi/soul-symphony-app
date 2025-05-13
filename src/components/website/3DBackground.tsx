
import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Animated sphere component
const AnimatedSphere = ({ position = [0, 0, 0], size = 1, color = "#8a2be2" }) => {
  const sphereRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (sphereRef.current) {
      // Create subtle floating animation
      sphereRef.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 0.5) * 0.3;
      
      // Slow rotation
      sphereRef.current.rotation.x = clock.getElapsedTime() * 0.1;
      sphereRef.current.rotation.y = clock.getElapsedTime() * 0.15;
    }
  });
  
  return (
    <mesh ref={sphereRef} position={position as [number, number, number]}>
      <sphereGeometry args={[size, 32, 32]} />
      <meshStandardMaterial 
        color={color} 
        roughness={0.4} 
        metalness={0.8} 
        emissive={color}
        emissiveIntensity={0.2}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
};

// Background component with multiple elements
export const ThreeDBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 opacity-50">
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        
        {/* Create our own stars background */}
        <Stars />
        
        {/* Animated spheres */}
        <AnimatedSphere position={[-3, 1, -2]} size={0.8} color="#8a2be2" />
        <AnimatedSphere position={[2, -1, -1]} size={1.2} color="#4169e1" />
        <AnimatedSphere position={[0, 0.5, -3]} size={1.5} color="#7b68ee" />
        
        {/* Add fog for depth */}
        <fog attach="fog" args={["#000", 8, 30]} />
        
        {/* Add orbit controls for interactivity */}
        <OrbitControls enableZoom={false} enablePan={false} enableRotate={true} />
      </Canvas>
    </div>
  );
};

// Custom Stars component since we can't use the drei Stars
const Stars = () => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Generate random stars
  const starCount = 1000;
  const positions = React.useMemo(() => {
    const pos = [];
    for (let i = 0; i < starCount; i++) {
      const x = (Math.random() - 0.5) * 100;
      const y = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;
      pos.push(x, y, z);
    }
    return new Float32Array(pos);
  }, [starCount]);
  
  // Animate stars
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.02;
    }
  });
  
  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={starCount}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={0.1} color="#ffffff" sizeAttenuation={true} />
      </points>
    </group>
  );
};

export default ThreeDBackground;
