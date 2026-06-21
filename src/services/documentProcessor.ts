// Sewa AI – Document Processing Pipeline
// Robust extraction for PDF (text + scanned OCR), DOCX, TXT, and images.

import * as pdfjs from 'pdfjs-dist';
// Bundle the PDF.js worker locally so its version always matches the installed
// pdfjs-dist. A CDN URL that doesn't exactly match the version silently breaks
// the worker, which makes every PDF fail text extraction.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Tesseract from 'tesseract.js';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ProcessedDocument {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'image' | 'unknown';
  size: number;
  pageCount?: number;
  wordCount: number;
  charCount: number;
  extractedText: string;
  extractionMethod: 'text' | 'ocr' | 'none';
  extractionStatus: 'success' | 'partial' | 'failed';
  errorMessage?: string;
  isScanned: boolean;
  metadata: Record<string, string>;
}

export interface ProcessingOptions {
  maxChars?: number;
}

const DEFAULT_MAX_CHARS = 12000;
const OCR_LANGUAGE = 'eng+nep';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

// Threshold below which text extraction is considered too sparse for a scanned/image document
const MIN_USEFUL_TEXT_CHARS = 60;

function generateDocId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;
}

function isLikelyBinaryGarbage(text: string): boolean {
  if (!text || text.length === 0) return true;

  // Count control/binary characters (excluding common whitespace)
  const controlChars = text.match(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g)?.length || 0;
  if (controlChars / text.length > 0.05) return true;

  // Count printable characters (letters, numbers, punctuation, whitespace, Devanagari)
  const printable = text.match(/[\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu)?.length || 0;
  if (printable / text.length < 0.85) return true;

  // High-bit characters with low print density indicates binary data
  const highBytes = text.match(/[\u0080-\u00FF]/g)?.length || 0;
  if (text.length > 200 && highBytes / text.length > 0.5) return true;

  return false;
}

function cleanExtractedText(text: string): string {
  return (
    text
      // Remove control characters except common whitespace
      .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, ' ')
      // Normalize newlines
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Collapse 3+ newlines
      .replace(/\n{3,}/g, '\n\n')
      // Collapse 4+ spaces
      .replace(/ {4,}/g, '  ')
      .trim()
  );
}

function truncateForAI(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const half = Math.floor(maxChars / 2) - 60;
  return (
    text.substring(0, half) +
    '\n\n[... middle of document omitted to fit within size limits ...]\n\n' +
    text.substring(text.length - half)
  );
}

function validateText(text: string): {
  valid: boolean;
  reason: 'empty' | 'binary_garbage' | 'too_short' | 'low_quality' | null;
  cleanedText: string;
} {
  if (!text || text.trim().length === 0) {
    return { valid: false, reason: 'empty', cleanedText: '' };
  }
  const cleaned = cleanExtractedText(text);
  if (cleaned.length === 0) {
    return { valid: false, reason: 'empty', cleanedText: '' };
  }
  if (isLikelyBinaryGarbage(cleaned)) {
    return { valid: false, reason: 'binary_garbage', cleanedText: cleaned };
  }
  return { valid: true, reason: null, cleanedText: cleaned };
}

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file, 'UTF-8');
  });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function countWords(text: string): number {
  // Match Devanagari words, Latin words, numbers
  const matches = text.match(/[\u0900-\u097F]+|[a-zA-Z0-9'_-]+/g);
  return matches ? matches.length : 0;
}

function createFailedDocument(
  file: File,
  type: ProcessedDocument['type'],
  pageCount: number | undefined,
  reason: string | undefined,
  isScanned: boolean
): ProcessedDocument {
  const safeReason = reason || 'unknown';
  const messages: Record<string, string> = {
    empty: 'No readable text could be extracted from this document. Please upload a clearer version.',
    binary_garbage:
      'Unable to extract text from this PDF. It may be scanned, encrypted, or image-based.',
    pdf_processing_error: 'Unable to process this PDF file. The file may be corrupted or password-protected.',
    docx_processing_error: 'Unable to process this DOCX file.',
    txt_processing_error: 'Unable to process this text file.',
    ocr_processing_error: 'OCR could not read text from the image. Please upload a clearer image.',
    unsupported_type: 'Unsupported file type. Please use PDF, DOCX, TXT, or images (JPG, PNG, WEBP).',
    file_too_large: 'File is too large. Maximum size is 25 MB.',
    unknown:
      'Document text could not be extracted. Please upload a clearer version or paste the text directly.',
  };

  return {
    id: generateDocId(),
    name: file.name,
    type,
    size: file.size,
    pageCount,
    wordCount: 0,
    charCount: 0,
    extractedText: '',
    extractionMethod: 'none',
    extractionStatus: 'failed',
    isScanned,
    metadata: { reason: safeReason },
    errorMessage:
      messages[safeReason] ||
      'Document text could not be extracted. Please upload a clearer version or paste the text directly.',
  };
}

// ===== PDF =====
async function extractFromPDF(file: File): Promise<ProcessedDocument> {
  let pdf: pdfjs.PDFDocumentProxy | null = null;

  try {
    const arrayBuffer = await readAsArrayBuffer(file);
    pdf = await pdfjs.getDocument({
      data: arrayBuffer,
      // Disable caching to avoid worker issues
      disableAutoFetch: false,
      disableStream: false,
    }).promise;

    const pageCount = pdf.numPages;
    const textParts: string[] = [];

    // Step 1: try extracting embedded text from each page
    for (let i = 1; i <= pageCount; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .filter((s) => s && s.trim().length > 0)
          .join(' ');
        if (pageText.trim()) {
          textParts.push(pageText);
        }
      } catch (pageErr) {
        console.warn(`Failed to extract text from PDF page ${i}:`, pageErr);
      }
    }

    let extractedText = textParts.join('\n\n');
    let extractionMethod: 'text' | 'ocr' | 'none' = 'text';
    let isScanned = false;

    const validation = validateText(extractedText);

    // Step 2: if text extraction failed or yielded too little text, run OCR on rendered page images
    if (!validation.valid || validation.cleanedText.length < MIN_USEFUL_TEXT_CHARS) {
      isScanned = true;
      extractionMethod = 'ocr';
      try {
        const ocrText = await ocrPdfPages(pdf, pageCount);
        if (ocrText && ocrText.trim().length > 0) {
          extractedText = ocrText;
        } else if (validation.cleanedText) {
          // Fall back to whatever text we extracted even if minimal
          extractedText = validation.cleanedText;
          extractionMethod = 'text'; // partial text only
        }
      } catch (ocrErr) {
        console.warn('OCR failed:', ocrErr);
        if (validation.cleanedText) {
          extractedText = validation.cleanedText;
          extractionMethod = 'text';
        }
      }
    } else {
      extractedText = validation.cleanedText;
    }

    const finalValidation = validateText(extractedText);

    if (!finalValidation.valid && finalValidation.reason === 'empty') {
      return createFailedDocument(file, 'pdf', pageCount, 'empty', isScanned);
    }

    const cleanedText = finalValidation.cleanedText || extractedText;

    return {
      id: generateDocId(),
      name: file.name,
      type: 'pdf',
      size: file.size,
      pageCount,
      wordCount: countWords(cleanedText),
      charCount: cleanedText.length,
      extractedText: cleanedText,
      extractionMethod,
      extractionStatus: finalValidation.valid ? 'success' : 'partial',
      isScanned,
      metadata: {
        pages: String(pageCount),
        method: extractionMethod,
      },
      errorMessage: finalValidation.valid
        ? undefined
        : 'Some text could not be fully extracted. Analysis is based on readable portions.',
    };
  } catch (err) {
    return createFailedDocument(
      file,
      'pdf',
      undefined,
      err instanceof Error ? err.message : 'pdf_processing_error',
      false
    );
  } finally {
    try {
      pdf?.destroy();
    } catch {
      // ignore
    }
  }
}

async function ocrPdfPages(pdf: pdfjs.PDFDocumentProxy, pageCount: number): Promise<string> {
  const results: string[] = [];

  for (let i = 1; i <= Math.min(pageCount, 5); i++) {
    try {
      const page = await pdf.getPage(i);
      // Render at higher scale for better OCR quality
      const viewport = page.getViewport({ scale: 2.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvas, viewport }).promise;

      const dataUrl = canvas.toDataURL('image/png');

      // Try with eng + Nepali; fallback to eng only if combined fails
      let text = '';
      try {
        const result = await Tesseract.recognize(dataUrl, OCR_LANGUAGE, {
          logger: () => {},
        });
        text = result.data.text || '';
      } catch (combinedErr) {
        try {
          const result = await Tesseract.recognize(dataUrl, 'eng', {
            logger: () => {},
          });
          text = result.data.text || '';
        } catch (engErr) {
          console.warn(`OCR failed on page ${i}:`, engErr);
        }
      }

      if (text.trim()) {
        results.push(`[Page ${i}]\n${text.trim()}`);
      }
    } catch (err) {
      console.warn(`OCR error on page ${i}:`, err);
    }
  }

  return results.join('\n\n');
}

// ===== DOCX =====
async function extractFromDOCX(file: File): Promise<ProcessedDocument> {
  try {
    const arrayBuffer = await readAsArrayBuffer(file);
    const uint8Array = new Uint8Array(arrayBuffer);
    const raw = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);

    // Extract text from <w:t> XML tags
    const textMatches: string[] = [];
    const xmlTextRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
    let match;
    while ((match = xmlTextRegex.exec(raw)) !== null) {
      if (match[1].trim()) textMatches.push(match[1]);
    }

    let extractedText = textMatches.join(' ');

    // Fallback: strip XML tags
    if (extractedText.length < 50) {
      extractedText = raw
        .replace(/<[^>]+>/g, ' ')
        .replace(/[^\x20-\x7E\u0900-\u097F\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    const validation = validateText(extractedText);

    if (!validation.valid) {
      return createFailedDocument(
        file,
        'docx',
        undefined,
        validation.reason === 'empty' ? 'empty' : 'docx_processing_error',
        false
      );
    }

    const cleanedText = validation.cleanedText;

    return {
      id: generateDocId(),
      name: file.name,
      type: 'docx',
      size: file.size,
      wordCount: countWords(cleanedText),
      charCount: cleanedText.length,
      extractedText: cleanedText,
      extractionMethod: 'text',
      extractionStatus: 'success',
      isScanned: false,
      metadata: { method: 'text' },
    };
  } catch (err) {
    return createFailedDocument(
      file,
      'docx',
      undefined,
      err instanceof Error ? err.message : 'docx_processing_error',
      false
    );
  }
}

// ===== TXT =====
async function extractFromTXT(file: File): Promise<ProcessedDocument> {
  try {
    const text = await readAsText(file);
    const validation = validateText(text);

    if (!validation.valid) {
      return createFailedDocument(
        file,
        'txt',
        undefined,
        validation.reason === 'empty' ? 'empty' : 'txt_processing_error',
        false
      );
    }

    const cleanedText = validation.cleanedText;

    return {
      id: generateDocId(),
      name: file.name,
      type: 'txt',
      size: file.size,
      wordCount: countWords(cleanedText),
      charCount: cleanedText.length,
      extractedText: cleanedText,
      extractionMethod: 'text',
      extractionStatus: 'success',
      isScanned: false,
      metadata: { method: 'text' },
    };
  } catch (err) {
    return createFailedDocument(
      file,
      'txt',
      undefined,
      err instanceof Error ? err.message : 'txt_processing_error',
      false
    );
  }
}

// ===== Image (direct OCR) =====
async function extractFromImage(file: File): Promise<ProcessedDocument> {
  try {
    const dataUrl = await readAsDataURL(file);
    let text = '';

    try {
      const result = await Tesseract.recognize(dataUrl, OCR_LANGUAGE, {
        logger: () => {},
      });
      text = result.data.text || '';
    } catch (combinedErr) {
      try {
        const result = await Tesseract.recognize(dataUrl, 'eng', {
          logger: () => {},
        });
        text = result.data.text || '';
      } catch (engErr) {
        return createFailedDocument(file, 'image', undefined, 'ocr_processing_error', true);
      }
    }

    const validation = validateText(text);

    if (!validation.valid) {
      return createFailedDocument(
        file,
        'image',
        undefined,
        validation.reason === 'empty' ? 'empty' : 'ocr_processing_error',
        true
      );
    }

    const cleanedText = validation.cleanedText;

    return {
      id: generateDocId(),
      name: file.name,
      type: 'image',
      size: file.size,
      wordCount: countWords(cleanedText),
      charCount: cleanedText.length,
      extractedText: cleanedText,
      extractionMethod: 'ocr',
      extractionStatus: 'success',
      isScanned: true,
      metadata: { method: 'ocr' },
    };
  } catch (err) {
    return createFailedDocument(
      file,
      'image',
      undefined,
      err instanceof Error ? err.message : 'ocr_processing_error',
      true
    );
  }
}

export async function processDocument(
  file: File,
  options: ProcessingOptions = {}
): Promise<ProcessedDocument> {
  const { maxChars = DEFAULT_MAX_CHARS } = options;

  if (file.size > MAX_FILE_SIZE) {
    return createFailedDocument(file, 'unknown', undefined, 'file_too_large', false);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  let result: ProcessedDocument;

  if (file.type === 'application/pdf' || ext === 'pdf') {
    result = await extractFromPDF(file);
  } else if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    result = await extractFromDOCX(file);
  } else if (file.type === 'text/plain' || ext === 'txt') {
    result = await extractFromTXT(file);
  } else if (file.type.startsWith('image/')) {
    result = await extractFromImage(file);
  } else {
    result = createFailedDocument(file, 'unknown', undefined, 'unsupported_type', false);
  }

  // Truncate if extraction succeeded and is too long
  if (result.extractionStatus !== 'failed' && result.extractedText.length > maxChars) {
    result.extractedText = truncateForAI(result.extractedText, maxChars);
    result.charCount = result.extractedText.length;
    result.wordCount = countWords(result.extractedText);
  }

  return result;
}

export function isProcessedDocumentFailed(doc: ProcessedDocument): boolean {
  return doc.extractionStatus === 'failed';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isValidFileType(file: File): boolean {
  const validTypes = [
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/tiff',
  ];
  const validExts = ['txt', 'pdf', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff'];
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  return validTypes.includes(file.type) || validExts.includes(ext);
}
