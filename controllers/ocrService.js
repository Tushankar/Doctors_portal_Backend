import Tesseract from "tesseract.js";
import natural from "natural";
import compromise from "compromise";
import axios from "axios";
import pdfParse from "pdf-parse/lib/pdf-parse.js"; // Import pdf-parse

// Removed Logger; using console for logging

class OCRService {
  static instance = null;

  constructor() {
    this.worker = null;
    this.isInitialized = false;
  }

  static getInstance() {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  /**
   * Initialize the OCR worker
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log("Initializing OCR service...");
      this.worker = await Tesseract.createWorker("eng");

      // Configure OCR parameters for better prescription reading
      await this.worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,()-/:; ",
      });

      this.isInitialized = true;
      console.log("OCR service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize OCR service:", error);
      throw new Error("OCR service initialization failed");
    }
  }

  /**
   * Process prescription image and extract text with OCR
   */
  async processPrescriptionImage(imageUrl, options = {}) {
    // If PDF, extract text without OCR using pdf-parse
    if (imageUrl.toLowerCase().endsWith(".pdf")) {
      console.log(`PDF detected, extracting text via pdf-parse: ${imageUrl}`);
      try {
        const pdfBuffer = await this.downloadImage(imageUrl);
        const pdfData = await pdfParse(pdfBuffer);
        const extractedText = pdfData.text || "";
        console.log(`PDF text extracted length: ${extractedText.length}`);
        const medicationResult = await this.parseMedications(extractedText);
        return {
          extractedText,
          medications: medicationResult.medications,
          confidence: medicationResult.confidence,
          processingStatus: "completed",
          processedAt: new Date(),
        };
      } catch (error) {
        console.error("PDF parsing failed:", error);
        return {
          extractedText: "",
          medications: [],
          confidence: 0,
          processingStatus: "failed",
          processingError: error.message,
          processedAt: new Date(),
        };
      }
    }
    if (!this.isInitialized || !this.worker) {
      await this.initialize();
    }

    try {
      console.log(`Starting OCR processing for image: ${imageUrl}`);

      // Download image from URL
      const imageBuffer = await this.downloadImage(imageUrl);

      // Perform OCR
      const { data } = await this.worker.recognize(imageBuffer);
      const extractedText = data.text;
      const ocrConfidence = data.confidence / 100; // Convert to 0-1 scale

      console.log(`OCR completed with confidence: ${ocrConfidence}`);

      // Parse medications from extracted text
      const medicationResult = await this.parseMedications(extractedText);

      const result = {
        extractedText,
        medications: medicationResult.medications,
        confidence: Math.min(ocrConfidence, medicationResult.confidence),
        processingStatus: "completed",
        processedAt: new Date(),
      };

      // Log warnings if any
      if (medicationResult.warnings.length > 0) {
        console.warn("OCR processing warnings:", medicationResult.warnings);
      }

      return result;
    } catch (error) {
      console.error("OCR processing failed:", error);

      return {
        extractedText: "",
        medications: [],
        confidence: 0,
        processingStatus: "failed",
        processingError:
          error instanceof Error ? error.message : "Unknown OCR error",
        processedAt: new Date(),
      };
    }
  }

  /**
   * Parse medications from extracted text using NLP
   */
  async parseMedications(text) {
    try {
      const medications = [];
      const warnings = [];
      let totalConfidence = 0;

      // Clean and normalize text
      const cleanText = this.cleanText(text);

      // Use compromise for NLP processing
      const doc = compromise(cleanText);

      // Extract potential medication lines
      const lines = cleanText
        .split("\n")
        .filter((line) => line.trim().length > 0);

      for (const line of lines) {
        const medication = await this.parseMedicationLine(line);
        if (medication) {
          medications.push(medication);
          totalConfidence += medication.confidence;
        }
      }

      // Calculate average confidence
      const averageConfidence =
        medications.length > 0 ? totalConfidence / medications.length : 0;

      // Add warnings for low confidence or missing information
      if (averageConfidence < 0.7) {
        warnings.push(
          "Low confidence in medication extraction. Manual review recommended."
        );
      }

      if (medications.length === 0) {
        warnings.push(
          "No medications detected in prescription. Manual review required."
        );
      }

      return {
        medications,
        confidence: averageConfidence,
        warnings,
      };
    } catch (error) {
      console.error("Medication parsing failed:", error);
      return {
        medications: [],
        confidence: 0,
        warnings: ["Failed to parse medications from text"],
      };
    }
  }

  /**
   * Parse a single line for medication information
   */
  async parseMedicationLine(line) {
    try {
      // Common medication patterns
      const medicationPatterns = [
        // Pattern: "Medication Name 100mg twice daily"
        /^([A-Za-z\s]+)\s+(\d+(?:\.\d+)?(?:mg|g|ml|mcg|units?))\s+(.+)$/i,
        // Pattern: "Medication Name - 100mg - twice daily"
        /^([A-Za-z\s]+)\s*-\s*(\d+(?:\.\d+)?(?:mg|g|ml|mcg|units?))\s*-\s*(.+)$/i,
        // Pattern: "Take Medication Name 100mg twice daily"
        /^(?:take\s+)?([A-Za-z\s]+)\s+(\d+(?:\.\d+)?(?:mg|g|ml|mcg|units?))\s+(.+)$/i,
      ];

      for (const pattern of medicationPatterns) {
        const match = line.match(pattern);
        if (match) {
          const [, name, dosage, instructions] = match;

          // Extract frequency from instructions
          const frequency = this.extractFrequency(instructions);
          const duration = this.extractDuration(instructions);

          // Calculate confidence based on completeness and pattern matching
          let confidence = 0.8;
          if (!frequency) confidence -= 0.2;
          if (!duration) confidence -= 0.1;
          if (name.length < 3) confidence -= 0.2;

          return {
            name: name.trim(),
            dosage: dosage.trim(),
            frequency: frequency || "as directed",
            duration,
            instructions: instructions.trim(),
            confidence: Math.max(0.1, confidence),
          };
        }
      }

      // Fallback: try to extract medication name if line contains common medication indicators
      const medicationIndicators = [
        "mg",
        "tablet",
        "capsule",
        "daily",
        "twice",
        "three times",
      ];
      const hasIndicator = medicationIndicators.some((indicator) =>
        line.toLowerCase().includes(indicator)
      );

      if (hasIndicator && line.length > 5) {
        // Extract potential medication name (first word or two)
        const words = line.trim().split(/\s+/);
        const name = words.slice(0, 2).join(" ");

        return {
          name,
          dosage: "as prescribed",
          frequency: "as directed",
          instructions: line.trim(),
          confidence: 0.3, // Low confidence for fallback parsing
        };
      }

      return null;
    } catch (error) {
      console.error("Error parsing medication line:", error);
      return null;
    }
  }

  /**
   * Extract frequency information from instruction text
   */
  extractFrequency(instructions) {
    const frequencyPatterns = [
      {
        pattern: /once\s+(?:a\s+)?daily|daily|1\s*x\s*daily/i,
        frequency: "once daily",
      },
      {
        pattern: /twice\s+(?:a\s+)?daily|2\s*x\s*daily|bid/i,
        frequency: "twice daily",
      },
      {
        pattern: /three\s+times\s+(?:a\s+)?daily|3\s*x\s*daily|tid/i,
        frequency: "three times daily",
      },
      {
        pattern: /four\s+times\s+(?:a\s+)?daily|4\s*x\s*daily|qid/i,
        frequency: "four times daily",
      },
      { pattern: /every\s+(\d+)\s+hours?/i, frequency: "every $1 hours" },
      { pattern: /as\s+needed|prn/i, frequency: "as needed" },
      { pattern: /before\s+meals?/i, frequency: "before meals" },
      { pattern: /after\s+meals?/i, frequency: "after meals" },
      { pattern: /at\s+bedtime|hs/i, frequency: "at bedtime" },
    ];

    for (const { pattern, frequency } of frequencyPatterns) {
      const match = instructions.match(pattern);
      if (match) {
        return frequency.replace("$1", match[1] || "");
      }
    }

    return undefined;
  }

  /**
   * Extract duration information from instruction text
   */
  extractDuration(instructions) {
    const durationPatterns = [
      /for\s+(\d+)\s+days?/i,
      /for\s+(\d+)\s+weeks?/i,
      /for\s+(\d+)\s+months?/i,
      /(\d+)\s+day\s+supply/i,
      /continue\s+for\s+(\d+)\s+days?/i,
    ];

    for (const pattern of durationPatterns) {
      const match = instructions.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return undefined;
  }

  /**
   * Clean and normalize extracted text
   */
  cleanText(text) {
    return text
      .replace(/[^\w\s\-.,():\/]/g, " ") // Remove special characters except common ones
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }

  /**
   * Download image from URL
   */
  async downloadImage(url) {
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000, // 30 second timeout
        headers: {
          "User-Agent": "Prescription-OCR-Service/1.0",
        },
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error("Failed to download image:", error);
      throw new Error("Failed to download prescription image");
    }
  }

  /**
   * Assess image quality and provide recommendations
   */
  async assessImageQuality(imageUrl) {
    try {
      // This is a simplified quality assessment
      // In a production system, you might use more sophisticated image analysis

      const imageBuffer = await this.downloadImage(imageUrl);

      // Basic quality indicators
      const fileSize = imageBuffer.length;
      const recommendations = [];
      let quality = "good";
      let confidence = 0.8;

      // Check file size (very basic quality indicator)
      if (fileSize < 50000) {
        // Less than 50KB
        quality = "poor";
        confidence = 0.3;
        recommendations.push(
          "Image appears to be low resolution. Please upload a higher quality image."
        );
      } else if (fileSize < 200000) {
        // Less than 200KB
        quality = "fair";
        confidence = 0.6;
        recommendations.push(
          "Image quality may be suboptimal. Consider uploading a clearer image if OCR results are poor."
        );
      }

      // Additional recommendations
      recommendations.push(
        "Ensure prescription is well-lit and text is clearly visible"
      );
      recommendations.push("Avoid shadows and glare on the prescription");
      recommendations.push(
        "Make sure the entire prescription is visible in the image"
      );

      return {
        quality,
        recommendations,
        confidence,
      };
    } catch (error) {
      console.error("Image quality assessment failed:", error);
      return {
        quality: "poor",
        recommendations: [
          "Unable to assess image quality. Please try uploading again.",
        ],
        confidence: 0,
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      console.log("OCR service cleaned up");
    }
  }
}

// Export singleton instance
export const ocrService = OCRService.getInstance();
