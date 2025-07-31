// Streaming response manager for real-time AI responses
export class StreamingResponseManager {
  private encoder = new TextEncoder();
  
  constructor(private writer: WritableStreamDefaultWriter<Uint8Array>) {}

  // Create a SSE-compatible streaming response
  static createStreamingResponse(): Response {
    const stream = new ReadableStream({
      start(controller) {
        return controller;
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  // Send progress update to client
  async sendProgress(stage: string, data?: any): Promise<void> {
    const progressEvent = {
      type: 'progress',
      stage,
      timestamp: Date.now(),
      data
    };

    await this.writeSSE(progressEvent);
  }

  // Send search results chunk
  async sendSearchResults(results: any[], searchType: 'vector' | 'sql' | 'combined'): Promise<void> {
    const resultsEvent = {
      type: 'search_results',
      searchType,
      count: results.length,
      results: results.slice(0, 3) // Send preview
    };

    await this.writeSSE(resultsEvent);
  }

  // Send streaming AI response chunk
  async sendResponseChunk(chunk: string, isComplete = false): Promise<void> {
    const responseEvent = {
      type: 'response_chunk',
      chunk,
      isComplete
    };

    await this.writeSSE(responseEvent);
  }

  // Send final analysis data
  async sendAnalysis(analysis: any): Promise<void> {
    const analysisEvent = {
      type: 'analysis',
      data: analysis
    };

    await this.writeSSE(analysisEvent);
  }

  // Send error event
  async sendError(error: string): Promise<void> {
    const errorEvent = {
      type: 'error',
      error,
      timestamp: Date.now()
    };

    await this.writeSSE(errorEvent);
  }

  // Complete the stream
  async complete(): Promise<void> {
    const completeEvent = {
      type: 'complete',
      timestamp: Date.now()
    };

    await this.writeSSE(completeEvent);
    await this.writer.close();
  }

  // Private method to write SSE-formatted data
  private async writeSSE(data: any): Promise<void> {
    const formatted = `data: ${JSON.stringify(data)}\n\n`;
    await this.writer.write(this.encoder.encode(formatted));
  }
}

// Factory function to create streaming response with controller
export function createStreamingResponse(): { response: Response; controller: ReadableStreamDefaultController<Uint8Array> } {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  
  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    }
  });

  const response = new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });

  return { response, controller: controller! };
}

// Stream manager for SSE responses
export class SSEStreamManager {
  private encoder = new TextEncoder();
  
  constructor(private controller: ReadableStreamDefaultController<Uint8Array>) {}

  async sendEvent(type: string, data: any): Promise<void> {
    const event = {
      type,
      data,
      timestamp: Date.now()
    };
    
    const formatted = `data: ${JSON.stringify(event)}\n\n`;
    this.controller.enqueue(this.encoder.encode(formatted));
  }

  async close(): Promise<void> {
    this.controller.close();
  }
}