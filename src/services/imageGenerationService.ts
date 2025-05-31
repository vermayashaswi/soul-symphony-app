
export interface ImageGenerationOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  includeWatermark?: boolean;
}

export interface ShareImageData {
  title: string;
  subtitle?: string;
  content: string;
  footer?: string;
  emoji?: string;
  gradient?: [string, string];
}

class ImageGenerationService {
  private readonly DEFAULT_OPTIONS: Required<ImageGenerationOptions> = {
    width: 1200,
    height: 630, // Optimal for social media
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    accentColor: '#8b5cf6',
    includeWatermark: true
  };

  async generateShareImage(data: ShareImageData, options: Partial<ImageGenerationOptions> = {}): Promise<string> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    const canvas = document.createElement('canvas');
    canvas.width = opts.width;
    canvas.height = opts.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    // Set up the canvas
    this.setupCanvas(ctx, canvas, opts, data.gradient);
    
    // Draw content
    await this.drawContent(ctx, canvas, data, opts);
    
    // Add watermark if enabled
    if (opts.includeWatermark) {
      this.drawWatermark(ctx, canvas, opts);
    }

    return canvas.toDataURL('image/png', 0.9);
  }

  private setupCanvas(
    ctx: CanvasRenderingContext2D, 
    canvas: HTMLCanvasElement, 
    options: Required<ImageGenerationOptions>,
    gradient?: [string, string]
  ): void {
    if (gradient) {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, gradient[0]);
      grad.addColorStop(1, gradient[1]);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = options.backgroundColor;
    }
    
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private async drawContent(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    data: ShareImageData,
    options: Required<ImageGenerationOptions>
  ): Promise<void> {
    const padding = 80;
    const contentWidth = canvas.width - (padding * 2);
    let y = padding;

    // Draw emoji if provided
    if (data.emoji) {
      ctx.font = '72px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(data.emoji, canvas.width / 2, y + 60);
      y += 120;
    }

    // Draw title
    ctx.fillStyle = options.textColor;
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    
    const titleLines = this.wrapText(ctx, data.title, contentWidth);
    for (const line of titleLines) {
      ctx.fillText(line, canvas.width / 2, y);
      y += 60;
    }

    y += 20;

    // Draw subtitle if provided
    if (data.subtitle) {
      ctx.font = '32px Arial, sans-serif';
      ctx.fillStyle = options.accentColor;
      const subtitleLines = this.wrapText(ctx, data.subtitle, contentWidth);
      for (const line of subtitleLines) {
        ctx.fillText(line, canvas.width / 2, y);
        y += 40;
      }
      y += 30;
    }

    // Draw main content
    ctx.font = '28px Arial, sans-serif';
    ctx.fillStyle = options.textColor;
    const contentLines = this.wrapText(ctx, data.content, contentWidth);
    const maxContentLines = Math.min(contentLines.length, 6); // Limit content lines
    
    for (let i = 0; i < maxContentLines; i++) {
      ctx.fillText(contentLines[i], canvas.width / 2, y);
      y += 35;
    }

    // Draw footer if provided
    if (data.footer) {
      y = canvas.height - padding - 30;
      ctx.font = '24px Arial, sans-serif';
      ctx.fillStyle = options.accentColor;
      ctx.fillText(data.footer, canvas.width / 2, y);
    }
  }

  private drawWatermark(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    options: Required<ImageGenerationOptions>
  ): void {
    ctx.font = '20px Arial, sans-serif';
    ctx.fillStyle = options.accentColor;
    ctx.textAlign = 'right';
    ctx.fillText('SOuLO - Soul Symphony', canvas.width - 30, canvas.height - 30);
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + ' ' + word).width;
      
      if (width < maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    
    lines.push(currentLine);
    return lines;
  }

  async generateMoodCalendarImage(year: number, month: number, moodData: Array<{date: string, sentiment: number}>): Promise<string> {
    const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    return this.generateShareImage({
      title: 'My Mood Calendar',
      subtitle: monthName,
      content: `Tracking my emotional journey through ${monthName}. Every day tells a story.`,
      footer: 'Track your emotions with SOuLO',
      emoji: '📅',
      gradient: ['#667eea', '#764ba2']
    });
  }

  async generateEmotionChartImage(emotions: Array<{name: string, score: number}>): Promise<string> {
    const topEmotions = emotions
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const emotionText = topEmotions
      .map(e => `${e.name}: ${Math.round(e.score * 100)}%`)
      .join(' • ');

    return this.generateShareImage({
      title: 'My Emotional Landscape',
      content: emotionText,
      footer: 'Understand your emotions with SOuLO',
      emoji: '🎭',
      gradient: ['#ff9a9e', '#fecfef']
    });
  }

  async generateAchievementImage(achievement: string, description: string): Promise<string> {
    return this.generateShareImage({
      title: 'Achievement Unlocked!',
      subtitle: achievement,
      content: description,
      footer: 'Celebrate growth with SOuLO',
      emoji: '🏆',
      gradient: ['#ffecd2', '#fcb69f']
    });
  }
}

export const imageGenerationService = new ImageGenerationService();
