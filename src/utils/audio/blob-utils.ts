
/**
 * Converts a Blob to a base64 string
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Validates audio blob before processing
 */
export const validateAudioBlob = (blob: Blob | null): { isValid: boolean; errorMessage?: string } => {
  if (!blob) {
    return { isValid: false, errorMessage: 'No audio recording found' };
  }

  if (blob.size < 100) {
    return { isValid: false, errorMessage: 'Audio recording is too small to process' };
  }

  return { isValid: true };
};

/**
 * Normalizes audio blob to a consistent format for processing
 */
export const normalizeAudioBlob = (blob: Blob): Blob => {
  // For now, just return the original blob
  // In the future, this could convert between formats if needed
  return blob;
};
