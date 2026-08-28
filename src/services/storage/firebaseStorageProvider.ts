import { MediaStorageProvider, MediaUploadOptions, MediaUploadResult } from './types';

/**
 * Firebase Storage Media Provider
 * Used when Firebase Storage bucket is enabled under Firebase project.
 */
export class FirebaseStorageProvider implements MediaStorageProvider {
  private bucketName?: string;

  constructor(bucketName?: string) {
    this.bucketName = bucketName || (typeof process !== 'undefined' ? process.env?.FIREBASE_STORAGE_BUCKET : undefined);
  }

  async uploadImage(options: MediaUploadOptions): Promise<MediaUploadResult> {
    const { imageBase64, userId = 'anon', checkinId = `checkin_${Date.now()}` } = options;
    const path = `bitequest/${userId}/${new Date().getFullYear()}/${checkinId}.jpg`;

    // Note: When Firebase Storage rules and bucket are provisioned, standard ref & uploadString run here.
    return {
      secureUrl: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
      publicId: path,
      format: 'jpeg',
    };
  }

  async deleteImage(publicId: string): Promise<boolean> {
    return true;
  }
}
