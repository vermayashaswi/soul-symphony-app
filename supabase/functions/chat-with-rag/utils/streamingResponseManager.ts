
// Streaming response manager for real-time AI responses
export class StreamingResponseManager {
  writer;
  encoder;
  
  constructor(writer) {
    this.writer = writer;
    this.encoder = new TextEncoder();
  }

  // Create a SSE-compatible streaming response
  static createStreamingResponse() {
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
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });
  }

  // Send progress update to client
  async sendProgress(stage, data) {
    const progressEvent = {
      type: 'progress',
      stage,
      timestamp: Date.now(),
      data
    };

    await this.writeSSE(progressEvent);
  }

  // Send search results chunk
  async sendSearchResults(results, searchType) {
    const resultsEvent = {
      type: 'search_results',
      searchType,
      count: results.length,
      results: results.slice(0, 3) // Send preview
    };

    await this.writeSSE(resultsEvent);
  }

  // Send streaming AI response chunk
  async sendResponseChunk(chunk, isComplete = false) {
    const responseEvent = {
      type: 'response_chunk',
      chunk,
      isComplete
    };

    await this.writeSSE(responseEvent);
  }

  // Send final analysis data
  async sendAnalysis(analysis) {
    const analysisEvent = {
      type: 'analysis',
      data: analysis
    };

    await this.writeSSE(analysisEvent);
  }

  // Send error event
  async sendError(error) {
    const errorEvent = {
      type: 'error',
      error,
      timestamp: Date.now()
    };

    await this.writeSSE(errorEvent);
  }

  // Complete the stream
  async complete() {
    const completeEvent = {
      type: 'complete',
      timestamp: Date.now()
    };

    await this.writeSSE(completeEvent);
    await this.writer.close();
  }

  // Private method to write SSE-formatted data
  async writeSSE(data) {
    const formatted = `data: ${JSON.stringify(data)}\n\n`;
    await this.writer.write(this.encoder.encode(formatted));
  }
}

// Factory function to create streaming response with controller
export function createStreamingResponse() {
  let controller;
  
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
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
    }
  });

  return { response, controller: controller };
}

// Stream manager for SSE responses
export class SSEStreamManager {
  controller;
  encoder;
  
  constructor(controller) {
    this.controller = controller;
    this.encoder = new TextEncoder();
  }

  async sendEvent(type, data) {
    const event = {
      type,
      data,
      timestamp: Date.now()
    };
    
    const formatted = `data: ${JSON.stringify(event)}\n\n`;
    this.controller.enqueue(this.encoder.encode(formatted));
  }

  // Send user-friendly status message for backend tasks
  async sendUserMessage(message, stage) {
    const event = {
      type: 'user_message',
      message,
      stage,
      timestamp: Date.now()
    };
    
    const formatted = `data: ${JSON.stringify(event)}\n\n`;
    this.controller.enqueue(this.encoder.encode(formatted));
  }

  // Send backend task update (triggers loading animation)
  async sendBackendTask(task, description) {
    const event = {
      type: 'backend_task',
      task,
      description,
      timestamp: Date.now()
    };
    
    const formatted = `data: ${JSON.stringify(event)}\n\n`;
    this.controller.enqueue(this.encoder.encode(formatted));
  }

  // Send progress update
  async sendProgress(stage, progress) {
    const event = {
      type: 'progress',
      stage,
      progress,
      timestamp: Date.now()
    };
    
    const formatted = `data: ${JSON.stringify(event)}\n\n`;
    this.controller.enqueue(this.encoder.encode(formatted));
  }

  async close() {
    this.controller.close();
  }
}
