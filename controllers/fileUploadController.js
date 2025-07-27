import {
  createUploadMiddleware,
  deleteCloudinaryFile,
  generateSignedUploadUrl,
  optimizeImageUrl,
  UPLOAD_PRESETS,
} from "../config/cloudinary.js";

export class FileUploadService {
  // Get upload middleware for specific preset
  getUploadMiddleware(preset) {
    return createUploadMiddleware(preset);
  }

  // Process uploaded file and return standardized result
  processUploadedFile(file) {
    // Map properties from multer-storage-cloudinary file object
    const publicId = file.public_id || file.filename;
    const secureUrl = file.secure_url || file.path;
    const format = file.format || file.mimetype.split("/")[1];
    const bytes = file.bytes || file.size;
    const width = file.width;
    const height = file.height;
    const resourceType = file.resource_type || file.resourceType || "auto";

    return {
      publicId,
      secureUrl,
      originalName: file.originalname,
      format,
      bytes,
      width,
      height,
      resourceType,
    };
  }

  // Handle file upload with error handling
  async handleFileUpload(req, res, next, preset) {
    return new Promise((resolve) => {
      const upload = this.getUploadMiddleware(preset).single("file");

      upload(req, res, (error) => {
        if (error) {
          resolve({
            success: false,
            error: error.message,
          });
          return;
        }

        if (!req.file) {
          resolve({
            success: false,
            error: "No file uploaded",
          });
          return;
        }

        const processedFile = this.processUploadedFile(req.file);
        resolve({
          success: true,
          file: processedFile,
        });
      });
    });
  }

  // Generate signed URL for direct client uploads
  generateSignedUrl(preset, userId) {
    try {
      return generateSignedUploadUrl(preset, userId);
    } catch (error) {
      throw new Error("Failed to generate signed upload URL");
    }
  }

  // Delete file from Cloudinary
  async deleteFile(publicId) {
    try {
      return await deleteCloudinaryFile(publicId);
    } catch (error) {
      console.error("Error deleting file:", error);
      return false;
    }
  }

  // Generate optimized image URL
  getOptimizedImageUrl(publicId, options = {}) {
    return optimizeImageUrl(publicId, options);
  }

  // Validate file before upload
  validateFile(file, preset) {
    const config = UPLOAD_PRESETS[preset];

    if (file.size > config.max_file_size) {
      return {
        valid: false,
        error: `File size exceeds limit of ${
          config.max_file_size / 1024 / 1024
        }MB`,
      };
    }

    const fileExtension = file.originalname.split(".").pop().toLowerCase();
    if (!fileExtension || !config.allowed_formats.includes(fileExtension)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed formats: ${config.allowed_formats.join(
          ", "
        )}`,
      };
    }

    const allowedMimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      pdf: "application/pdf",
    };

    const expectedMimeType = allowedMimeTypes[fileExtension];
    if (expectedMimeType && file.mimetype !== expectedMimeType) {
      return {
        valid: false,
        error: "File type does not match file extension",
      };
    }

    return { valid: true };
  }

  // Get file info from Cloudinary
  async getFileInfo(publicId) {
    try {
      const { v2: cloudinary } = await import("cloudinary");
      const result = await cloudinary.api.resource(publicId);
      return result;
    } catch (error) {
      console.error("Error getting file info:", error);
      return null;
    }
  }

  // Upload file directly
  async uploadFile(file, folder) {
    try {
      const { v2: cloudinary } = await import("cloudinary");

      const fileStr = `data:${file.mimetype};base64,${file.buffer.toString(
        "base64"
      )}`;

      const uploadResult = await cloudinary.uploader.upload(fileStr, {
        folder: folder,
        resource_type: "auto",
        public_id: `${Date.now()}_${file.originalname.split(".")[0]}`,
      });

      return {
        success: true,
        data: {
          filename: file.originalname,
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Batch delete files
  async deleteMultipleFiles(publicIds) {
    const results = await Promise.allSettled(
      publicIds.map((id) => this.deleteFile(id))
    );

    const success = [];
    const failed = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        success.push(publicIds[index]);
      } else {
        failed.push(publicIds[index]);
      }
    });

    return { success, failed };
  }
}

export const fileUploadService = new FileUploadService();
