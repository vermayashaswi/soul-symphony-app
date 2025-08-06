
import { fetchWithRetry } from '@/utils/api-client';

export type TranscriptionOptions = {
  highQuality?: boolean;
  directTranscription?: boolean;
  recordingTime?: number;
  timezone?: string;
};

export type TranscriptionResult = {
  id: number;
  entryId?: number; // Add the missing entryId property
  tempId?: string; // Add the missing tempId property
  transcription: string;
  refined: string;
  language: string;
  languages: string[];
  emotions: { [key: string]: number };
  sentiment: string;
  duration: number;
  audioUrl: string | null;
  processingTime: number;
  success: boolean;
};

export class TranscriptionError extends Error {
  public code: string;
  public details: any;

  constructor(message: string, code: string, details: any = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'TranscriptionError';
  }
}

export class TranscriptionService {
  private supabaseUrl: string;
  private userId: string;
  private authToken: string | null;

  constructor(supabaseUrl: string, userId: string, authToken: string | null = null) {
    if (!supabaseUrl) {
      throw new Error('Supabase URL is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }

    this.supabaseUrl = supabaseUrl;
    this.userId = userId;
    this.authToken = authToken;
  }

  async transcribeAudio(
    audioBlob: Blob,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    try {
      if (!audioBlob) {
        throw new Error('Audio blob is required');
      }

      if (audioBlob.size > 20 * 1024 * 1024) {
        throw new Error('Audio file size exceeds the limit of 20MB');
      }

      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64Data = btoa(String.fromCharCode(...uint8Array));
      
      const formData = new FormData();
      formData.append('audio', base64Data);
      formData.append('userId', this.userId);
      formData.append('highQuality', options.highQuality?.toString() || 'true');
      formData.append('directTranscription', options.directTranscription?.toString() || 'false');
      
      if (options.recordingTime) {
        formData.append('recordingTime', options.recordingTime.toString());
      }

      const headers: Record<string, string> = {
        'x-timezone': options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        'x-request-timestamp': new Date().toISOString(),
        'x-client-version': '1.0.0',
        'x-audio-size': audioBlob.size.toString()
      };

      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      // Use enhanced fetch
      const response = await fetchWithRetry(`${this.supabaseUrl}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          audio: base64Data,
          userId: this.userId,
          highQuality: options.highQuality || true,
          directTranscription: options.directTranscription || false,
          recordingTime: options.recordingTime
        }),
        retries: 2,
        timeout: 60000 // 60 seconds for transcription
      });


      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Transcription failed with status ${response.status}`);
      }

      const result = await response.json();
      
      if (!result) {
        throw new Error('Transcription failed: No result received');
      }

      if (result.error) {
        throw new Error(`Transcription failed: ${result.error}`);
      }

      if (!result.transcription) {
        throw new Error('Transcription failed: No transcription received');
      }

      return {
        id: result.id || result.entryId,
        entryId: result.entryId || result.id, // Map entryId from the response
        tempId: result.tempId, // Include tempId from the response
        transcription: result.transcription,
        refined: result.refined,
        language: result.language,
        languages: result.languages || [result.language],
        emotions: result.emotions || {},
        sentiment: result.sentiment,
        duration: result.duration,
        audioUrl: result.audioUrl,
        processingTime: Date.now() - startTime,
        success: true
      };

    } catch (error) {
      console.error('Transcription failed:', error);
      

      if (error.message.includes('Audio file size exceeds the limit')) {
        throw new TranscriptionError(
          'Audio file size exceeds the limit of 20MB',
          'FILE_SIZE_LIMIT_EXCEEDED',
          { retryable: false }
        );
      }

      throw new TranscriptionError(
        error.message || 'Transcription failed',
        'TRANSCRIPTION_FAILED',
        { retryable: true }
      );
    }
  }
}

export default TranscriptionService;
