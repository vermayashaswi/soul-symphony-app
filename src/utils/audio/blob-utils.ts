
/**
 * Utility functions for working with Blob objects
 */

// Convert a Blob to a base64 string
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Extract just the base64 data without the data URL prefix
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = () => {
        reject(new Error('Error reading blob as base64'));
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      reject(error);
    }
  });
};

// Convert a base64 string to a Blob
export const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

// Get MIME type from a Blob
export const getMimeType = async (blob: Blob): Promise<string> => {
  return blob.type || 'audio/wav'; // Default to audio/wav if type is not available
};

// Get file size in human-readable format
export const formatBlobSize = (blob: Blob): string => {
  const size = blob.size;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

// Validate an audio blob
export const validateAudioBlob = (blob: Blob | null): { isValid: boolean; errorMessage?: string } => {
  if (!blob) {
    return { isValid: false, errorMessage: 'No audio data available' };
  }
  
  if (blob.size < 100) {
    return { isValid: false, errorMessage: 'Audio data is too small or empty' };
  }
  
  return { isValid: true };
};

// Normalize an audio blob (ensure consistent format and properties)
export const normalizeAudioBlob = async (blob: Blob): Promise<Blob> => {
  if (!blob) {
    throw new Error('No audio blob to normalize');
  }
  
  // For now, we just return the same blob
  // In a real implementation, you might convert to a standard format
  
  return blob;
};
