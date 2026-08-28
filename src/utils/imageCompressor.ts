/**
 * Utility to compress and resize images client-side before sending to server or storing.
 * Ensures fast network transfer, saves bandwidth and prevents large payload errors.
 */
export async function compressImage(
  fileOrBase64: File | string,
  maxWidth: number = 1024,
  maxHeight: number = 1024,
  quality: number = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Fallback to original string if canvas context fails
        resolve(typeof fileOrBase64 === "string" ? fileOrBase64 : URL.createObjectURL(fileOrBase64));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl);
    };

    img.onerror = (err) => {
      console.error("Image load error during compression:", err);
      // Fallback
      if (typeof fileOrBase64 === "string") {
        resolve(fileOrBase64);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (readErr) => reject(readErr);
        reader.readAsDataURL(fileOrBase64);
      }
    };

    if (typeof fileOrBase64 === "string") {
      img.src = fileOrBase64;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(fileOrBase64);
    }
  });
}
