import imageCompression from 'browser-image-compression';

export interface CompressedImageResult {
  file: File;
  dataUrl: string;
  base64: string;
  sizeBytes: number;
  originalSizeBytes: number;
}

/**
 * Compresses camera capture or selected image file before Gemini AI Verification and Cloud Storage.
 * Retains high readability for OCR (signage, menu text) while reducing payload size from 5-15MB to ~0.5-0.8MB.
 */
export async function compressImageFile(
  imageFile: File,
  options?: { maxSizeMB?: number; maxWidthOrHeight?: number }
): Promise<CompressedImageResult> {
  const originalSizeBytes = imageFile.size;

  const compressionOptions = {
    maxSizeMB: options?.maxSizeMB || 0.8,
    maxWidthOrHeight: options?.maxWidthOrHeight || 1440,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.82,
  };

  try {
    const compressedBlob = await imageCompression(imageFile, compressionOptions);
    const compressedFile = new File([compressedBlob], imageFile.name || 'bite_capture.jpg', {
      type: 'image/jpeg',
    });

    const dataUrl = await imageCompression.getDataUrlFromFile(compressedFile);
    const base64 = dataUrl.split(',')[1] || dataUrl;

    return {
      file: compressedFile,
      dataUrl,
      base64,
      sizeBytes: compressedFile.size,
      originalSizeBytes,
    };
  } catch (err) {
    console.warn('Image compression fallback (using original):', err);
    const fallbackDataUrl = await imageCompression.getDataUrlFromFile(imageFile);
    const fallbackBase64 = fallbackDataUrl.split(',')[1] || fallbackDataUrl;

    return {
      file: imageFile,
      dataUrl: fallbackDataUrl,
      base64: fallbackBase64,
      sizeBytes: imageFile.size,
      originalSizeBytes,
    };
  }
}

/**
 * Converts a data URL / Base64 string to a compressed Data URL
 */
export async function compressBase64(dataUrlOrBase64: string): Promise<string> {
  try {
    const fullDataUrl = dataUrlOrBase64.startsWith('data:')
      ? dataUrlOrBase64
      : `data:image/jpeg;base64,${dataUrlOrBase64}`;

    const res = await fetch(fullDataUrl);
    const blob = await res.blob();
    const file = new File([blob], 'capture.jpg', { type: blob.type || 'image/jpeg' });

    const compressed = await compressImageFile(file);
    return compressed.dataUrl;
  } catch (err) {
    console.warn('Base64 compression fallback:', err);
    return dataUrlOrBase64;
  }
}
