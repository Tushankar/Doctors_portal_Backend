// import { v2 as cloudinary } from "cloudinary";
// import { CloudinaryStorage } from "multer-storage-cloudinary";
// import multer from "multer";

// // Configure Cloudinary with environment variables
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "diaybbqo5",
//   api_key: process.env.CLOUDINARY_API_KEY || "434841113357938",
//   api_secret: process.env.CLOUDINARY_API_SECRET || "M28Lk8RRxSh6RXgfqeFdhg36Smk",
// });

// // Preset configurations
// export const UPLOAD_PRESETS = {
//   PRESCRIPTION: {
//     folder: "prescriptions",
//     max_file_size: 5 * 1024 * 1024, // 5MB
//     allowed_formats: ["jpg", "jpeg", "png", "pdf"],
//   },
// };

// /**
//  * Create multer middleware for direct uploads to Cloudinary
//  */
// export function createUploadMiddleware(preset) {
//   const config = UPLOAD_PRESETS[preset];
//   const storage = new CloudinaryStorage({
//     cloudinary,
//     params: {
//       folder: config.folder,
//       format: async (req, file) => file.originalname.split(".").pop(),
//       public_id: (req, file) =>
//         `${Date.now()}_${file.originalname.split(".")[0]}`,
//     },
//   });

//   return multer({
//     storage,
//     limits: { fileSize: config.max_file_size },
//     fileFilter: (req, file, cb) => {
//       const ext = file.originalname.split(".").pop().toLowerCase();
//       if (config.allowed_formats.includes(ext)) {
//         cb(null, true);
//       } else {
//         cb(new Error(`File type not allowed: ${ext}`));
//       }
//     },
//   });
// }

// /**
//  * Generate signed URL for client-side direct uploads
//  */
// export function generateSignedUploadUrl(preset, userId) {
//   const folder = UPLOAD_PRESETS[preset].folder;
//   const timestamp = Math.round(Date.now() / 1000);
//   const signature = cloudinary.utils.api_sign_request(
//     { timestamp, folder, upload_preset: preset },
//     cloudinary.config().api_secret
//   );

//   return {
//     url: `https://api.cloudinary.com/v1_1/${
//       cloudinary.config().cloud_name
//     }/auto/upload`,
//     params: {
//       api_key: cloudinary.config().api_key,
//       timestamp,
//       signature,
//       folder,
//       upload_preset: preset,
//     },
//   };
// }

// /**
//  * Delete a file from Cloudinary by public ID
//  */
// export async function deleteCloudinaryFile(publicId) {
//   return cloudinary.uploader.destroy(publicId);
// }

// /**
//  * Generate optimized image URL
//  */
// export function optimizeImageUrl(publicId, options = {}) {
//   return cloudinary.url(publicId, options);
// }

import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "diaybbqo5",
  api_key: process.env.CLOUDINARY_API_KEY || "434841113357938",
  api_secret:
    process.env.CLOUDINARY_API_SECRET || "M28Lk8RRxSh6RXgfqeFdhg36Smk",
});

// Preset configurations
export const UPLOAD_PRESETS = {
  PRESCRIPTION: {
    folder: "prescriptions",
    max_file_size: 5 * 1024 * 1024, // 5MB
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
  },
  PHARMACY_VERIFICATION: {
    folder: "pharmacy_verification",
    max_file_size: 10 * 1024 * 1024, // 10MB for verification documents
    allowed_formats: ["pdf"], // Restrict to PDFs for verification documents
  },
};

/**
 * Create multer middleware for direct uploads to Cloudinary
 */
export function createUploadMiddleware(preset) {
  const config = UPLOAD_PRESETS[preset];
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: config.folder,
      format: async (req, file) => file.originalname.split(".").pop(),
      public_id: (req, file) =>
        `${Date.now()}_${file.originalname.split(".")[0]}`,
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

/**
 * Generate signed URL for client-side direct uploads
 */
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

/**
 * Delete a file from Cloudinary by public ID
 */
export async function deleteCloudinaryFile(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

/**
 * Generate optimized image URL
 */
export function optimizeImageUrl(publicId, options = {}) {
  return cloudinary.url(publicId, options);
}
