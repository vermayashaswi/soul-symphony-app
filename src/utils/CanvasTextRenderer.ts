import * as THREE from 'three';

interface CanvasTextOptions {
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  maxWidth: number;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  padding: number;
  backgroundColor?: string;
  borderRadius?: number;
}

interface TextMetrics {
  width: number;
  height: number;
  lines: string[];
}

export class CanvasTextRenderer {
  private textureCache = new Map<string, THREE.Texture>();
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d')!;
    // Enable high DPI rendering
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = 'high';
  }

  private getCacheKey(options: CanvasTextOptions): string {
    return JSON.stringify(options);
  }

  private measureText(text: string, options: CanvasTextOptions): TextMetrics {
    const { fontSize, fontFamily, maxWidth, lineHeight } = options;
    
    this.context.font = `${fontSize}px ${fontFamily}`;
    
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    let maxLineWidth = 0;

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = this.context.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        maxLineWidth = Math.max(maxLineWidth, this.context.measureText(currentLine).width);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
      maxLineWidth = Math.max(maxLineWidth, this.context.measureText(currentLine).width);
    }

    const totalHeight = lines.length * fontSize * lineHeight;
    
    return {
      width: Math.min(maxLineWidth, maxWidth),
      height: totalHeight,
      lines
    };
  }

  private getAlignmentOffset(lineWidth: number, canvasWidth: number, align: string): number {
    switch (align) {
      case 'center':
        return (canvasWidth - lineWidth) / 2;
      case 'right':
        return canvasWidth - lineWidth;
      default:
        return 0;
    }
  }

  generateTexture(options: CanvasTextOptions): THREE.Texture {
    const cacheKey = this.getCacheKey(options);
    
    // Return cached texture if available
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!;
    }

    const {
      text,
      fontSize,
      fontFamily,
      color,
      textAlign,
      lineHeight,
      padding,
      backgroundColor,
      borderRadius = 0
    } = options;

    // Measure text to determine canvas size
    const metrics = this.measureText(text, options);
    const canvasWidth = Math.ceil(metrics.width + padding * 2);
    const canvasHeight = Math.ceil(metrics.height + padding * 2);

    // Set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = canvasWidth * dpr;
    this.canvas.height = canvasHeight * dpr;
    
    // Scale context for high DPI
    this.context.scale(dpr, dpr);
    
    // Set canvas display size
    this.canvas.style.width = `${canvasWidth}px`;
    this.canvas.style.height = `${canvasHeight}px`;

    // Clear canvas
    this.context.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw background if specified
    if (backgroundColor) {
      this.context.fillStyle = backgroundColor;
      if (borderRadius > 0) {
        this.drawRoundedRect(0, 0, canvasWidth, canvasHeight, borderRadius);
        this.context.fill();
      } else {
        this.context.fillRect(0, 0, canvasWidth, canvasHeight);
      }
    }

    // Set text properties
    this.context.font = `${fontSize}px ${fontFamily}`;
    this.context.fillStyle = color;
    this.context.textBaseline = 'top';

    // Draw text lines
    metrics.lines.forEach((line, index) => {
      const lineWidth = this.context.measureText(line).width;
      const x = padding + this.getAlignmentOffset(lineWidth, canvasWidth - padding * 2, textAlign);
      const y = padding + index * fontSize * lineHeight;
      
      this.context.fillText(line, x, y);
    });

    // Create texture
    const texture = new THREE.CanvasTexture(this.canvas);
    texture.generateMipmaps = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Cache the texture
    this.textureCache.set(cacheKey, texture);

    return texture;
  }

  private drawRoundedRect(x: number, y: number, width: number, height: number, radius: number) {
    this.context.beginPath();
    this.context.moveTo(x + radius, y);
    this.context.lineTo(x + width - radius, y);
    this.context.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.context.lineTo(x + width, y + height - radius);
    this.context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.context.lineTo(x + radius, y + height);
    this.context.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.context.lineTo(x, y + radius);
    this.context.quadraticCurveTo(x, y, x + radius, y);
    this.context.closePath();
  }

  // Calculate optimal geometry size based on text metrics
  calculateGeometrySize(options: CanvasTextOptions): { width: number; height: number } {
    const metrics = this.measureText(options.text, options);
    const totalWidth = metrics.width + options.padding * 2;
    const totalHeight = metrics.height + options.padding * 2;
    
    // Convert pixels to 3D units (adjust scale factor as needed)
    const scaleFactor = 0.01;
    return {
      width: totalWidth * scaleFactor,
      height: totalHeight * scaleFactor
    };
  }

  clearCache() {
    // Dispose of all cached textures
    this.textureCache.forEach(texture => texture.dispose());
    this.textureCache.clear();
  }

  dispose() {
    this.clearCache();
  }
}