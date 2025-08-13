// }
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

// Configure Cloudinary with env variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload presets for different use cases
export const UPLOAD_PRESETS = {
  PRESCRIPTION: {
    folder: "prescriptions",
    max_file_size: 5 * 1024 * 1024, // 5 MB
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
  },
  PHARMACY_VERIFICATION: {
    folder: "pharmacy_verification",
    max_file_size: 10 * 1024 * 1024, // 10 MB
    allowed_formats: ["pdf"],
  },
};

// ✅ Create multer middleware for uploads
export function createUploadMiddleware(preset) {
  const config = UPLOAD_PRESETS[preset];

  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      const ext = file.originalname.split(".").pop().toLowerCase();
      const isPdf = ext === "pdf";

      return {
        folder: config.folder,
        format: ext,
        resource_type: isPdf ? "raw" : "image", // ✅ Critical for PDF support
        public_id: `${Date.now()}_${file.originalname.split(".")[0]}`,
      };
    },
  });

  return multer({
    storage,
    limits: { fileSize: config.max_file_size },
    fileFilter: (req, file, cb) => {
      const ext = file.originalname.split(".").pop().toLowerCase();
      if (config.allowed_formats.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`File type not allowed: ${ext}`));
      }
    },
  });
}

// ✅ Delete file from Cloudinary
export async function deleteCloudinaryFile(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

// ✅ Generate image URL with transformation
export function optimizeImageUrl(publicId, options = {}) {
  return cloudinary.url(publicId, options);
}

// ✅ Optional: Generate signed upload URL (client-side uploads)
export function generateSignedUploadUrl(preset, userId) {
  const folder = UPLOAD_PRESETS[preset].folder;
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, upload_preset: preset },
    cloudinary.config().api_secret
  );

  return {
    url: `https://api.cloudinary.com/v1_1/${
      cloudinary.config().cloud_name
    }/auto/upload`,
    params: {
      api_key: cloudinary.config().api_key,
      timestamp,
      signature,
      folder,
      upload_preset: preset,
    },
  };
}
