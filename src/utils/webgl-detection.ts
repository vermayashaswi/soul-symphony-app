
export interface WebGLCapabilities {
  isSupported: boolean;
  maxTextureSize: number;
  maxVertexAttributes: number;
  hasFloatTextures: boolean;
  hasDepthTexture: boolean;
  renderer: string;
  vendor: string;
}

export function detectWebGLCapabilities(): WebGLCapabilities {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
  
  if (!gl) {
    return {
      isSupported: false,
      maxTextureSize: 0,
      maxVertexAttributes: 0,
      hasFloatTextures: false,
      hasDepthTexture: false,
      renderer: 'Unknown',
      vendor: 'Unknown'
    };
  }

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  
  return {
    isSupported: true,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxVertexAttributes: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
    hasFloatTextures: !!gl.getExtension('OES_texture_float'),
    hasDepthTexture: !!gl.getExtension('WEBGL_depth_texture'),
    renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown',
    vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'Unknown'
  };
}

export function isWebGLCompatible(): boolean {
  const capabilities = detectWebGLCapabilities();
  return capabilities.isSupported && capabilities.maxTextureSize >= 512;
}
