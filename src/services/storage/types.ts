export interface MediaUploadOptions {
  imageBase64: string;
  folder?: string;
  userId?: string;
  checkinId?: string;
}

export interface MediaUploadResult {
  secureUrl: string;
  publicId: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
}

export interface MediaStorageProvider {
  uploadImage(options: MediaUploadOptions): Promise<MediaUploadResult>;
  deleteImage?(publicId: string): Promise<boolean>;
}
