import Tesseract from "tesseract.js";
import natural from "natural";
import compromise from "compromise";
import axios from "axios";
import pdfParse from "pdf-parse/lib/pdf-parse.js"; // Import pdf-parse
import sharp from "sharp"; // For image preprocessing

// Removed Logger; using console for logging

class OCRService {
  static instance = null;

  constructor() {
    this.worker = null;
    this.handwritingWorker = null;
    this.isInitialized = false;
    this.supportedFormats = [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".pdf"];
  }

  static getInstance() {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  /**
   * Initialize the OCR workers with optimized configurations
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log("Initializing OCR service with enhanced configurations...");

      // Initialize main OCR worker for printed text with correct v6 syntax
      this.worker = await Tesseract.createWorker("eng", 1, {
        logger: (m) => console.log("OCR Worker:", m),
      });

      // Configure for printed/digital text - set parameters during initialization
      await this.worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,()-/:;% ",
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
        textord_min_linesize: "2.5",
      });

      // Initialize secondary worker for handwritten text
      this.handwritingWorker = await Tesseract.createWorker("eng", 1, {
        logger: (m) => console.log("Handwriting Worker:", m),
      });

      // Configure for handwritten text - only set changeable parameters
      await this.handwritingWorker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,()-/:;% ",
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
        textord_min_linesize: "1.25",
        textord_old_baselines: "0",
        textord_old_xheight: "0",
      });

      this.isInitialized = true;
      console.log("OCR service initialized successfully with dual workers");
    } catch (error) {
      console.error("Failed to initialize OCR service:", error);
      this.isInitialized = false;
      // Clean up any partially initialized workers
      if (this.worker) {
        try {
          await this.worker.terminate();
        } catch (e) {}
        this.worker = null;
      }
      if (this.handwritingWorker) {
        try {
          await this.handwritingWorker.terminate();
        } catch (e) {}
        this.handwritingWorker = null;
      }
      throw new Error("OCR service initialization failed");
    }
  }

  /**
   * Process prescription image and extract text with advanced OCR and robust error handling
   */
  async processPrescriptionImage(imageUrl, options = {}) {
    console.log(`🔄 Starting OCR processing for: ${imageUrl}`);

    // Handle PDF files separately
    if (imageUrl.toLowerCase().endsWith(".pdf")) {
      console.log(
        `📄 PDF detected, extracting text via pdf-parse: ${imageUrl}`
      );
      return await this.processPDFFile(imageUrl);
    }

    // Ensure OCR service is initialized
    if (!this.isInitialized || !this.worker || !this.handwritingWorker) {
      console.log("🚀 Initializing OCR service...");
      await this.initialize();
    }

    try {
      // Download and validate image
      let imageBuffer;
      try {
        imageBuffer = await this.downloadImage(imageUrl);
      } catch (downloadError) {
        console.error("❌ Image download failed:", downloadError.message);
        return {
          extractedText: "",
          medications: [],
          confidence: 0,
          processingStatus: "failed",
          processingError: `Image download failed: ${downloadError.message}`,
          processedAt: new Date(),
        };
      }

      // Determine text type with fallback
      let textType;
      try {
        textType = await this.detectTextType(imageBuffer);
        console.log(`🔍 Detected text type: ${textType}`);
      } catch (detectionError) {
        console.warn(
          "⚠️ Text type detection failed, using mixed approach:",
          detectionError.message
        );
        textType = "mixed";
      }

      // Preprocess image with error handling
      let preprocessedImages;
      try {
        preprocessedImages = await this.preprocessImage(imageBuffer, textType);
        console.log(
          `🖼️ Preprocessing completed: ${
            Object.keys(preprocessedImages).length
          } versions`
        );
      } catch (preprocessError) {
        console.warn(
          "⚠️ Image preprocessing failed, using original:",
          preprocessError.message
        );
        preprocessedImages = { original: imageBuffer };
      }

      // Perform OCR with multiple approaches
      let ocrResults;
      try {
        ocrResults = await this.performMultipleOCR(
          preprocessedImages,
          textType
        );
        console.log(`📊 OCR completed with ${ocrResults.length} results`);
      } catch (ocrError) {
        console.error("❌ All OCR attempts failed:", ocrError.message);
        return {
          extractedText: "",
          medications: [],
          confidence: 0,
          processingStatus: "failed",
          processingError: `OCR processing failed: ${ocrError.message}`,
          processedAt: new Date(),
        };
      }

      // Select best result
      const bestResult = this.selectBestOCRResult(ocrResults);

      if (!bestResult || !bestResult.text || bestResult.confidence === 0) {
        console.warn("⚠️ No viable OCR results obtained");
        return {
          extractedText: "",
          medications: [],
          confidence: 0,
          processingStatus: "failed",
          processingError: "No readable text could be extracted from the image",
          processedAt: new Date(),
        };
      }

      console.log(
        `✅ Best OCR result: ${bestResult.approach} (confidence: ${(
          bestResult.confidence * 100
        ).toFixed(1)}%)`
      );

      // Parse medications from extracted text
      let medicationResult;
      try {
        medicationResult = await this.parseMedications(bestResult.text);
        console.log(
          `💊 Medication parsing completed: ${medicationResult.medications.length} medications found`
        );
      } catch (parsingError) {
        console.error("❌ Medication parsing failed:", parsingError.message);
        medicationResult = {
          medications: [],
          confidence: 0,
          warnings: [`Medication parsing failed: ${parsingError.message}`],
        };
      }

      const result = {
        extractedText: bestResult.text,
        medications: medicationResult.medications,
        confidence: Math.min(
          bestResult.confidence,
          medicationResult.confidence
        ),
        processingStatus: "completed",
        processedAt: new Date(),
        metadata: {
          textType,
          ocrApproach: bestResult.approach,
          preprocessing: bestResult.preprocessing,
          totalAttempts: ocrResults.length,
        },
        warnings: medicationResult.warnings || [],
      };

      // Log warnings if any
      if (result.warnings.length > 0) {
        console.warn("⚠️ OCR processing warnings:", result.warnings);
      }

      console.log(`🎉 OCR processing completed successfully!`);
      return result;
    } catch (error) {
      console.error("💥 OCR processing failed with unexpected error:", error);

      return {
        extractedText: "",
        medications: [],
        confidence: 0,
        processingStatus: "failed",
        processingError:
          error instanceof Error ? error.message : "Unknown OCR error",
        processedAt: new Date(),
        metadata: {
          textType: "unknown",
          ocrApproach: "none",
          preprocessing: "none",
        },
      };
    }
  }

  /**
   * Process PDF files
   */
  async processPDFFile(imageUrl) {
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
        metadata: {
          textType: "digital",
          ocrApproach: "pdf-parse",
          preprocessing: "none",
        },
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

  /**
   * Detect if text is handwritten or printed with safe sampling
   */
  async detectTextType(imageBuffer) {
    try {
      // Use image analysis to detect text characteristics
      const metadata = await sharp(imageBuffer).metadata();
      console.log(`Analyzing image: ${metadata.width}x${metadata.height}`);

      // Create a small sample for quick analysis (avoid processing huge images)
      let sampleBuffer = imageBuffer;
      if (imageBuffer.length > 500000) {
        // If larger than 500KB
        console.log("Creating smaller sample for text type detection");
        sampleBuffer = await sharp(imageBuffer)
          .resize(800, 600, { fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
      }

      // Quick OCR sample to analyze text characteristics with timeout protection
      let sampleResult;
      try {
        // Use a promise with timeout to prevent hanging
        const ocrPromise = this.worker.recognize(sampleBuffer);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("OCR timeout")), 10000)
        );

        sampleResult = await Promise.race([ocrPromise, timeoutPromise]);
      } catch (ocrError) {
        console.warn(
          "Quick OCR analysis failed, defaulting to mixed approach:",
          ocrError.message
        );
        return "mixed";
      }

      // Analyze confidence and character patterns
      const avgConfidence = sampleResult.data.confidence;
      const text = sampleResult.data.text;

      console.log(
        `Text type analysis - Confidence: ${avgConfidence}, Text length: ${text.length}`
      );

      // Heuristics for handwritten vs printed text
      let handwrittenIndicators = 0;

      // Low confidence usually indicates handwritten text
      if (avgConfidence < 60) handwrittenIndicators++;

      // Irregular spacing patterns
      if (text.includes("  ") || text.includes("\n\n")) handwrittenIndicators++;

      // Character substitution patterns common in handwriting OCR
      const handwritingErrors = ["rn", "cl", "1l", "0o"];
      if (handwritingErrors.some((pattern) => text.includes(pattern)))
        handwrittenIndicators++;

      // Short or fragmented text often indicates handwriting
      if (text.length < 50 && avgConfidence < 70) handwrittenIndicators++;

      const detectedType =
        handwrittenIndicators >= 2 ? "handwritten" : "printed";
      console.log(
        `Detected text type: ${detectedType} (indicators: ${handwrittenIndicators})`
      );

      return detectedType;
    } catch (error) {
      console.error("Error detecting text type:", error);
      return "mixed"; // Default to mixed approach for safety
    }
  }

  /**
   * Preprocess image for better OCR results with error handling
   */
  async preprocessImage(imageBuffer, textType) {
    try {
      const preprocessedImages = {};

      // Original image (always include as fallback)
      preprocessedImages.original = imageBuffer;

      console.log(`Preprocessing image for ${textType} text type`);

      // Get image metadata safely
      let metadata;
      try {
        metadata = await sharp(imageBuffer).metadata();
        console.log(
          `Image info: ${metadata.width}x${metadata.height}, format: ${metadata.format}`
        );
      } catch (metadataError) {
        console.warn(
          "Could not read image metadata, using original only:",
          metadataError.message
        );
        return preprocessedImages;
      }

      // Enhanced contrast and sharpening for printed text
      if (textType === "printed" || textType === "mixed") {
        try {
          preprocessedImages.enhanced = await sharp(imageBuffer)
            .normalize()
            .sharpen({ sigma: 1, flat: 1, jagged: 2 })
            .modulate({ brightness: 1.1, saturation: 0 })
            .png({ quality: 90 })
            .toBuffer();
          console.log("✅ Created enhanced version for printed text");
        } catch (error) {
          console.warn("❌ Failed to create enhanced version:", error.message);
        }
      }

      // Special preprocessing for handwritten text
      if (textType === "handwritten" || textType === "mixed") {
        try {
          preprocessedImages.handwriting = await sharp(imageBuffer)
            .normalize()
            .modulate({ brightness: 1.2, saturation: 0 })
            .blur(0.3)
            .sharpen({ sigma: 0.5, flat: 1, jagged: 1 })
            .png({ quality: 90 })
            .toBuffer();
          console.log("✅ Created handwriting-optimized version");
        } catch (error) {
          console.warn(
            "❌ Failed to create handwriting version:",
            error.message
          );
        }
      }

      // High contrast version (only if we have reasonable image size)
      if (
        metadata.width &&
        metadata.height &&
        metadata.width * metadata.height < 4000000
      ) {
        try {
          preprocessedImages.highContrast = await sharp(imageBuffer)
            .normalize()
            .modulate({ brightness: 1.3, saturation: 0 })
            .linear(1.5, -(128 * 1.5) + 128)
            .png({ quality: 90 })
            .toBuffer();
          console.log("✅ Created high contrast version");
        } catch (error) {
          console.warn(
            "❌ Failed to create high contrast version:",
            error.message
          );
        }
      }

      // Upscaled version for better resolution (only for small images)
      if (
        metadata.width &&
        metadata.height &&
        (metadata.width < 1000 || metadata.height < 1000) &&
        metadata.width * metadata.height < 1000000
      ) {
        try {
          preprocessedImages.upscaled = await sharp(imageBuffer)
            .resize(metadata.width * 2, metadata.height * 2, {
              kernel: sharp.kernel.lanczos3,
            })
            .normalize()
            .png({ quality: 90 })
            .toBuffer();
          console.log("✅ Created upscaled version");
        } catch (error) {
          console.warn("❌ Failed to create upscaled version:", error.message);
        }
      }

      console.log(
        `Preprocessing completed: ${
          Object.keys(preprocessedImages).length
        } versions created`
      );
      return preprocessedImages;
    } catch (error) {
      console.error("Error preprocessing image:", error);
      // Return at least the original image
      return { original: imageBuffer };
    }
  }

  /**
   * Perform OCR with multiple approaches and workers with enhanced error handling
   */
  async performMultipleOCR(preprocessedImages, textType) {
    const ocrResults = [];
    const maxRetries = 2;

    try {
      console.log(
        `Starting OCR with ${
          Object.keys(preprocessedImages).length
        } preprocessed images`
      );

      // Strategy 1: Use appropriate worker for detected text type
      if (textType === "printed") {
        for (const [preprocessing, imageBuffer] of Object.entries(
          preprocessedImages
        )) {
          let attempts = 0;
          while (attempts < maxRetries) {
            try {
              console.log(
                `Attempting printed OCR for ${preprocessing} (attempt ${
                  attempts + 1
                })`
              );
              const result = await this.performSafeOCR(
                this.worker,
                imageBuffer,
                15000
              );
              ocrResults.push({
                text: result.data.text,
                confidence: result.data.confidence / 100,
                approach: "printed-optimized",
                preprocessing,
              });
              console.log(`✅ Printed OCR succeeded for ${preprocessing}`);
              break;
            } catch (error) {
              attempts++;
              console.error(
                `❌ Printed OCR failed for ${preprocessing} (attempt ${attempts}):`,
                error.message
              );
              if (attempts >= maxRetries) {
                console.warn(
                  `⚠️ Skipping ${preprocessing} after ${maxRetries} failed attempts`
                );
              }
            }
          }
        }
      } else if (textType === "handwritten") {
        for (const [preprocessing, imageBuffer] of Object.entries(
          preprocessedImages
        )) {
          let attempts = 0;
          while (attempts < maxRetries) {
            try {
              console.log(
                `Attempting handwriting OCR for ${preprocessing} (attempt ${
                  attempts + 1
                })`
              );
              const result = await this.performSafeOCR(
                this.handwritingWorker,
                imageBuffer,
                20000
              );
              ocrResults.push({
                text: result.data.text,
                confidence: result.data.confidence / 100,
                approach: "handwriting-optimized",
                preprocessing,
              });
              console.log(`✅ Handwriting OCR succeeded for ${preprocessing}`);
              break;
            } catch (error) {
              attempts++;
              console.error(
                `❌ Handwriting OCR failed for ${preprocessing} (attempt ${attempts}):`,
                error.message
              );
              if (attempts >= maxRetries) {
                console.warn(
                  `⚠️ Skipping ${preprocessing} after ${maxRetries} failed attempts`
                );
              }
            }
          }
        }
      } else {
        // Mixed approach - try both workers but with limited attempts
        const limitedImages = Object.entries(preprocessedImages).slice(0, 2); // Limit to 2 images for mixed mode

        for (const [preprocessing, imageBuffer] of limitedImages) {
          // Try printed text worker first
          try {
            console.log(
              `Attempting printed OCR for ${preprocessing} in mixed mode`
            );
            const printedResult = await this.performSafeOCR(
              this.worker,
              imageBuffer,
              12000
            );
            ocrResults.push({
              text: printedResult.data.text,
              confidence: printedResult.data.confidence / 100,
              approach: "printed-worker",
              preprocessing,
            });
            console.log(
              `✅ Printed OCR succeeded in mixed mode for ${preprocessing}`
            );
          } catch (error) {
            console.error(
              `❌ Mixed printed OCR failed for ${preprocessing}:`,
              error.message
            );
          }

          // Try handwriting worker second
          try {
            console.log(
              `Attempting handwriting OCR for ${preprocessing} in mixed mode`
            );
            const handwritingResult = await this.performSafeOCR(
              this.handwritingWorker,
              imageBuffer,
              15000
            );
            ocrResults.push({
              text: handwritingResult.data.text,
              confidence: handwritingResult.data.confidence / 100,
              approach: "handwriting-worker",
              preprocessing,
            });
            console.log(
              `✅ Handwriting OCR succeeded in mixed mode for ${preprocessing}`
            );
          } catch (error) {
            console.error(
              `❌ Mixed handwriting OCR failed for ${preprocessing}:`,
              error.message
            );
          }
        }
      }

      console.log(`OCR processing completed with ${ocrResults.length} results`);
    } catch (error) {
      console.error("Multiple OCR processing failed:", error);
    }

    return ocrResults;
  }

  /**
   * Perform OCR with timeout protection
   */
  async performSafeOCR(worker, imageBuffer, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`OCR timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      worker
        .recognize(imageBuffer)
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Select the best OCR result based on confidence and content quality
   */
  selectBestOCRResult(ocrResults) {
    if (ocrResults.length === 0) {
      return {
        text: "",
        confidence: 0,
        approach: "none",
        preprocessing: "none",
      };
    }

    // Score results based on multiple factors
    const scoredResults = ocrResults.map((result) => {
      let score = result.confidence;

      // Bonus for longer text (more content likely means better recognition)
      score += Math.min(result.text.length / 1000, 0.2);

      // Bonus for medical terms presence
      const medicalTerms = [
        "mg",
        "tablet",
        "capsule",
        "daily",
        "twice",
        "prescription",
        "dose",
        "take",
      ];
      const medicalTermCount = medicalTerms.filter((term) =>
        result.text.toLowerCase().includes(term)
      ).length;
      score += medicalTermCount * 0.05;

      // Penalty for too many special characters (likely OCR errors)
      const specialCharRatio =
        (result.text.match(/[^a-zA-Z0-9\s.,()-]/g) || []).length /
        result.text.length;
      score -= specialCharRatio * 0.3;

      return { ...result, score };
    });

    // Sort by score and return the best
    scoredResults.sort((a, b) => b.score - a.score);

    console.log(
      `Selected best OCR result: ${scoredResults[0].approach} with ${
        scoredResults[0].preprocessing
      } preprocessing (score: ${scoredResults[0].score.toFixed(2)})`
    );

    return scoredResults[0];
  }

  /**
   * Parse medications from extracted text using enhanced NLP
   */
  async parseMedications(text) {
    try {
      const medications = [];
      const warnings = [];
      let totalConfidence = 0;

      // Clean and normalize text with enhanced preprocessing
      const cleanText = this.cleanAndCorrectText(text);

      // Use compromise for NLP processing
      const doc = compromise(cleanText);

      // Extract potential medication lines with multiple strategies
      const lines = cleanText
        .split(/[\n\r]+/)
        .map((line) => line.trim())
        .filter((line) => line.length > 2);

      // Strategy 1: Line-by-line parsing
      for (const line of lines) {
        const medication = await this.parseMedicationLine(line);
        if (medication) {
          medications.push(medication);
          totalConfidence += medication.confidence;
        }
      }

      // Strategy 2: Block parsing for handwritten text
      if (medications.length === 0) {
        const blockMedications = await this.parseHandwrittenBlock(cleanText);
        medications.push(...blockMedications);
        totalConfidence += blockMedications.reduce(
          (sum, med) => sum + med.confidence,
          0
        );
      }

      // Strategy 3: Fuzzy matching for common medications
      if (medications.length === 0) {
        const fuzzyMedications = await this.fuzzyMatchMedications(cleanText);
        medications.push(...fuzzyMedications);
        totalConfidence += fuzzyMedications.reduce(
          (sum, med) => sum + med.confidence,
          0
        );
      }

      // Calculate average confidence
      const averageConfidence =
        medications.length > 0 ? totalConfidence / medications.length : 0;

      // Enhanced validation and warnings
      const validatedMedications =
        this.validateAndEnhanceMedications(medications);
      const enhancedWarnings = this.generateEnhancedWarnings(
        validatedMedications,
        averageConfidence,
        text
      );

      return {
        medications: validatedMedications,
        confidence: averageConfidence,
        warnings: enhancedWarnings,
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
   * Enhanced text cleaning and error correction
   */
  cleanAndCorrectText(text) {
    let cleaned = text;

    // Common OCR corrections for handwritten text
    const corrections = {
      // Character substitutions
      rn: "m",
      cl: "d",
      "1l": "ll",
      "0o": "oo",
      "5g": "mg",
      rnq: "mg",
      q: "g",
      iu: "mg",
      // Common handwriting misreads
      twlce: "twice",
      dally: "daily",
      takc: "take",
      tablct: "tablet",
      capslue: "capsule",
      moming: "morning",
      evenlng: "evening",
      // Numbers
      Z: "2",
      S: "5",
      I: "1",
      O: "0",
    };

    // Apply corrections
    for (const [wrong, correct] of Object.entries(corrections)) {
      const regex = new RegExp(wrong, "gi");
      cleaned = cleaned.replace(regex, correct);
    }

    // Remove excessive whitespace and normalize
    cleaned = cleaned
      .replace(/[^\w\s\-.,():\/]/g, " ") // Remove special characters except common ones
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    return cleaned;
  }

  /**
   * Parse handwritten text as blocks rather than lines
   */
  async parseHandwrittenBlock(text) {
    const medications = [];

    // Split by common delimiters that might appear in handwritten prescriptions
    const blocks = text.split(/(?:\d+\.|•|\*|\-\s|\n\s*\n)/);

    for (const block of blocks) {
      if (block.trim().length < 5) continue;

      // Look for medication patterns in blocks
      const blockMedication = await this.extractMedicationFromBlock(
        block.trim()
      );
      if (blockMedication) {
        medications.push(blockMedication);
      }
    }

    return medications;
  }

  /**
   * Extract medication information from a text block
   */
  async extractMedicationFromBlock(block) {
    // Common medication name patterns (more flexible for handwriting)
    const medicationWords = block.split(/\s+/);

    // Look for dosage indicators
    const dosageMatch = block.match(
      /(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|units?|iu|tablets?|capsules?))/i
    );

    // Look for frequency indicators
    const frequencyMatch = block.match(
      /(once|twice|thrice|three times?|four times?|\d+\s*times?)\s*(?:a\s*)?(?:day|daily|per day)/i
    );

    if (medicationWords.length > 0 && (dosageMatch || frequencyMatch)) {
      // Try to identify the medication name (usually first 1-2 words before dosage)
      let medicationName = "";
      for (let i = 0; i < Math.min(3, medicationWords.length); i++) {
        const word = medicationWords[i];
        if (
          !/\d/.test(word) &&
          !/(mg|g|ml|mcg|tablet|capsule|once|twice|daily)/i.test(word)
        ) {
          medicationName += (medicationName ? " " : "") + word;
        } else {
          break;
        }
      }

      if (medicationName.length > 2) {
        return {
          name: medicationName,
          dosage: dosageMatch ? dosageMatch[1] : "as prescribed",
          frequency: frequencyMatch ? frequencyMatch[0] : "as directed",
          instructions: block,
          confidence: 0.4, // Lower confidence for block parsing
        };
      }
    }

    return null;
  }

  /**
   * Fuzzy matching against common medication names
   */
  async fuzzyMatchMedications(text) {
    const commonMedications = [
      "amoxicillin",
      "ibuprofen",
      "acetaminophen",
      "paracetamol",
      "aspirin",
      "metformin",
      "lisinopril",
      "atorvastatin",
      "omeprazole",
      "levothyroxine",
      "amlodipine",
      "metoprolol",
      "losartan",
      "hydrochlorothiazide",
      "albuterol",
      "furosemide",
      "prednisone",
      "gabapentin",
      "sertraline",
      "citalopram",
    ];

    const medications = [];
    const words = text.toLowerCase().split(/\s+/);

    for (const medication of commonMedications) {
      for (const word of words) {
        // Simple Levenshtein distance for fuzzy matching
        if (
          this.calculateSimilarity(medication, word) > 0.7 &&
          word.length > 3
        ) {
          // Look for dosage near this word
          const wordIndex = words.indexOf(word);
          const context = words
            .slice(Math.max(0, wordIndex - 2), wordIndex + 5)
            .join(" ");
          const dosageMatch = context.match(
            /(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg))/i
          );

          medications.push({
            name: medication,
            dosage: dosageMatch ? dosageMatch[1] : "as prescribed",
            frequency: "as directed",
            instructions: context,
            confidence: 0.3, // Lower confidence for fuzzy matching
          });
          break;
        }
      }
    }

    return medications;
  }

  /**
   * Calculate string similarity (simple implementation)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Validate and enhance medication information
   */
  validateAndEnhanceMedications(medications) {
    return medications.map((medication) => {
      // Enhance confidence based on completeness
      let enhancedConfidence = medication.confidence;

      // Boost confidence for complete information
      if (medication.dosage && medication.dosage !== "as prescribed") {
        enhancedConfidence += 0.1;
      }
      if (medication.frequency && medication.frequency !== "as directed") {
        enhancedConfidence += 0.1;
      }

      // Ensure medication name is properly capitalized
      const enhancedName = medication.name
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");

      return {
        ...medication,
        name: enhancedName,
        confidence: Math.min(enhancedConfidence, 1.0),
      };
    });
  }

  /**
   * Generate enhanced warnings based on analysis
   */
  generateEnhancedWarnings(medications, averageConfidence, originalText) {
    const warnings = [];

    if (averageConfidence < 0.5) {
      warnings.push(
        "Very low confidence in medication extraction. Manual review strongly recommended."
      );
    } else if (averageConfidence < 0.7) {
      warnings.push(
        "Low confidence in medication extraction. Manual review recommended."
      );
    }

    if (medications.length === 0) {
      warnings.push(
        "No medications detected in prescription. Manual review required."
      );
    }

    // Check for incomplete information
    const incompleteMedications = medications.filter(
      (med) => med.dosage === "as prescribed" || med.frequency === "as directed"
    );

    if (incompleteMedications.length > 0) {
      warnings.push(
        `${incompleteMedications.length} medication(s) have incomplete dosage or frequency information.`
      );
    }

    // Check if text appears to be handwritten
    if (originalText.length > 0 && averageConfidence < 0.6) {
      warnings.push(
        "Text appears to be handwritten. Consider requesting clearer image or digital prescription."
      );
    }

    return warnings;
  }

  /**
   * Parse a single line for medication information (enhanced for handwritten text)
   */
  async parseMedicationLine(line) {
    try {
      // Enhanced medication patterns for both printed and handwritten text
      const medicationPatterns = [
        // Standard patterns
        /^([A-Za-z\s]+)\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|units?|iu|tablets?|capsules?))\s+(.+)$/i,
        /^([A-Za-z\s]+)\s*[-:]\s*(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|units?|iu|tablets?|capsules?))\s*[-:]\s*(.+)$/i,
        /^(?:take\s+|rx\s+)?([A-Za-z\s]+)\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|units?|iu|tablets?|capsules?))\s+(.+)$/i,

        // Handwritten variations (more flexible spacing and separators)
        /^([A-Za-z\s]+)\s*[.,:;]\s*(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|units?|iu|tablets?|capsules?))\s*[.,:;]?\s*(.+)$/i,
        /^(\d+)\.\s*([A-Za-z\s]+)\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|units?|iu|tablets?|capsules?))\s+(.+)$/i,

        // Dosage first patterns (common in handwritten prescriptions)
        /^(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|units?|iu|tablets?|capsules?))\s+([A-Za-z\s]+)\s+(.+)$/i,

        // Flexible patterns for messy handwriting
        /([A-Za-z]{3,}(?:\s+[A-Za-z]+)?)\s*[^\w\s]*\s*(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|units?|iu))\s*[^\w\s]*\s*(.{5,})/i,
      ];

      for (const pattern of medicationPatterns) {
        const match = line.match(pattern);
        if (match) {
          let name, dosage, instructions;

          // Handle different match group arrangements
          if (pattern.source.includes("(d+)\\.\\s*")) {
            // Pattern with numbering
            [, , name, dosage, instructions] = match;
          } else if (pattern.source.startsWith("(\\d+")) {
            // Dosage-first pattern
            [, dosage, name, instructions] = match;
          } else {
            // Standard pattern
            [, name, dosage, instructions] = match;
          }

          // Clean extracted parts
          name = name?.trim().replace(/[^\w\s]/g, "");
          dosage = dosage?.trim();
          instructions = instructions?.trim();

          if (!name || name.length < 2) continue;

          // Extract frequency from instructions
          const frequency = this.extractFrequency(instructions);
          const duration = this.extractDuration(instructions);

          // Enhanced confidence calculation
          let confidence = 0.7; // Base confidence for pattern match

          // Boost confidence for complete information
          if (frequency && frequency !== "as directed") confidence += 0.1;
          if (duration) confidence += 0.1;
          if (name.length >= 5) confidence += 0.1;
          if (dosage.match(/^\d+(?:\.\d+)?\s*(mg|g|ml|mcg)$/i))
            confidence += 0.1;

          // Reduce confidence for suspicious patterns
          if (name.length > 30) confidence -= 0.2; // Too long
          if (instructions.length < 5) confidence -= 0.1; // Too short
          if (!/[a-zA-Z]/.test(name)) confidence -= 0.3; // No letters in name

          return {
            name: this.cleanMedicationName(name),
            dosage: this.cleanDosage(dosage),
            frequency: frequency || "as directed",
            duration,
            instructions: instructions,
            confidence: Math.max(0.1, Math.min(1.0, confidence)),
          };
        }
      }

      // Enhanced fallback parsing for challenging handwritten text
      return this.fallbackMedicationParsing(line);
    } catch (error) {
      console.error("Error parsing medication line:", error);
      return null;
    }
  }

  /**
   * Clean and standardize medication names
   */
  cleanMedicationName(name) {
    return name
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  /**
   * Clean and standardize dosage information
   */
  cleanDosage(dosage) {
    return dosage
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase()
      .replace(/(\d+)\s*(mg|g|ml|mcg|units?|iu|tablets?|capsules?)/i, "$1$2");
  }

  /**
   * Fallback parsing for difficult cases
   */
  fallbackMedicationParsing(line) {
    const medicationIndicators = [
      "mg",
      "mcg",
      "g",
      "ml",
      "iu",
      "units",
      "tablet",
      "capsule",
      "daily",
      "twice",
      "bid",
      "tid",
      "qid",
      "once",
      "morning",
      "evening",
    ];

    const hasIndicator = medicationIndicators.some((indicator) =>
      line.toLowerCase().includes(indicator)
    );

    if (hasIndicator && line.length > 5) {
      const words = line.trim().split(/\s+/);

      // Try to find the medication name (usually at the beginning)
      let medicationName = "";
      for (let i = 0; i < Math.min(3, words.length); i++) {
        const word = words[i];
        if (
          !/^\d/.test(word) &&
          !/(mg|mcg|g|ml|iu|tablet|capsule|daily|twice)/i.test(word)
        ) {
          medicationName += (medicationName ? " " : "") + word;
        } else {
          break;
        }
      }

      // Try to extract dosage
      const dosageMatch = line.match(
        /(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?|tablets?|capsules?))/i
      );

      // Try to extract frequency
      const frequencyMatch = line.match(
        /(once|twice|thrice|\d+\s*times?)\s*(?:a\s*)?(?:day|daily)/i
      );

      if (medicationName.length > 2) {
        return {
          name: this.cleanMedicationName(medicationName),
          dosage: dosageMatch
            ? this.cleanDosage(dosageMatch[1])
            : "as prescribed",
          frequency: frequencyMatch ? frequencyMatch[0] : "as directed",
          instructions: line.trim(),
          confidence: 0.3, // Low confidence for fallback parsing
        };
      }
    }

    return null;
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
   * Download image from URL with better error handling
   */
  async downloadImage(url) {
    try {
      console.log(`Downloading image from: ${url}`);
      
      // For Cloudinary URLs, modify to use public access
      let downloadUrl = url;
      if (url.includes('cloudinary.com') && url.includes('/raw/upload/')) {
        // Convert raw upload URL to image URL for public access
        downloadUrl = url.replace('/raw/upload/', '/image/upload/');
        console.log(`Modified Cloudinary URL: ${downloadUrl}`);
      }
      
      const response = await axios.get(downloadUrl, {
        responseType: "arraybuffer",
        timeout: 30000, // 30 second timeout
        headers: {
          "User-Agent": "Prescription-OCR-Service/1.0",
          Accept: "image/*,application/pdf",
        },
        maxContentLength: 50 * 1024 * 1024, // 50MB max
      });

      const buffer = Buffer.from(response.data);
      console.log(`Downloaded image: ${buffer.length} bytes`);

      // Validate the image using Sharp
      try {
        const metadata = await sharp(buffer).metadata();
        console.log(
          `Image metadata: ${metadata.width}x${metadata.height}, format: ${metadata.format}`
        );

        // Convert problematic formats to PNG for better compatibility
        if (
          metadata.format &&
          !["png", "jpeg", "jpg"].includes(metadata.format.toLowerCase())
        ) {
          console.log(
            `Converting ${metadata.format} to PNG for better OCR compatibility`
          );
          return await sharp(buffer).png({ quality: 90 }).toBuffer();
        }

        return buffer;
      } catch (sharpError) {
        console.warn(
          "Sharp validation failed, using original buffer:",
          sharpError.message
        );
        return buffer;
      }
    } catch (error) {
      console.error("Failed to download image:", error);
      if (error.code === "ECONNABORTED") {
        throw new Error("Image download timeout - please try again");
      } else if (error.response?.status === 404) {
        throw new Error("Image not found - please check the URL");
      } else {
        throw new Error("Failed to download prescription image");
      }
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
    const promises = [];

    if (this.worker) {
      promises.push(this.worker.terminate());
      this.worker = null;
    }

    if (this.handwritingWorker) {
      promises.push(this.handwritingWorker.terminate());
      this.handwritingWorker = null;
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      this.isInitialized = false;
      console.log("OCR service cleaned up - terminated all workers");
    }
  }
}

// Export singleton instance
export const ocrService = OCRService.getInstance();
