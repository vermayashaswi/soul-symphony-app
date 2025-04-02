
/// <reference types="vite/client" />

// Configure TypeScript to allow deeper type instantiation and provide better error messages
// @ts-ignore
declare namespace TSConfig {
  interface CompilerOptions {
    // Increase the maximum depth for type instantiation
    typeInstantiationDepth: 100;
    // Show full error messages without truncation
    noErrorTruncation: true;
  }
}

