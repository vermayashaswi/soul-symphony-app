
/// <reference types="vite/client" />

/**
 * TypeScript configuration to increase type instantiation depth 
 * and improve error messages for debugging complex types.
 */
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// TypeScript compiler options for enhancing type handling
interface CompilerOptions {
  // Increase maximum type instantiation depth to handle complex types
  typeInstantiationDepth: number;
  // Show full error messages without truncation for better debugging
  noErrorTruncation: boolean;
}
