import { v2 as cloudinary } from 'cloudinary';
import { MediaStorageProvider, MediaUploadOptions, MediaUploadResult } from './types';

export class CloudinaryStorageProvider implements MediaStorageProvider {
  private isConfigured: boolean = false;

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.isConfigured = true;
    }
  }

  async uploadImage(options: MediaUploadOptions): Promise<MediaUploadResult> {
    const { imageBase64, folder = 'bitequest/bites', userId = 'anonymous', checkinId = `checkin_${Date.now()}` } = options;

    if (!this.isConfigured) {
      // Graceful fallback if Cloudinary credentials are not set yet
      // Return the base64 or a clean placeholder URL so checkin flow doesn't break
      return {
        secureUrl: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
        publicId: `local_${checkinId}`,
        format: 'jpeg',
      };
    }

    try {
      const publicId = `${userId}_${checkinId}`;
      const uploadRes = await cloudinary.uploader.upload(imageBase64, {
        folder,
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { width: 1600, height: 1600, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });

      return {
        secureUrl: uploadRes.secure_url,
        publicId: uploadRes.public_id,
        format: uploadRes.format,
        width: uploadRes.width,
        height: uploadRes.height,
        bytes: uploadRes.bytes,
      };
    } catch (error) {
      console.error('Cloudinary upload error, using fallback:', error);
      return {
        secureUrl: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
        publicId: `fallback_${checkinId}`,
        format: 'jpeg',
      };
    }
  }

  async deleteImage(publicId: string): Promise<boolean> {
    if (!this.isConfigured) return true;
    try {
      await cloudinary.uploader.destroy(publicId);
      return true;
    } catch {
      return false;
    }
  }
}

export const mediaStorageProvider = new CloudinaryStorageProvider();
