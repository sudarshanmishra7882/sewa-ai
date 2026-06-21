import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  processDocument,
  ProcessedDocument,
  formatFileSize,
  isValidFileType,
} from '../services/documentProcessor';

interface FileUploadProps {
  onDocumentProcessed: (doc: ProcessedDocument) => void;
  mode: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDocumentProcessed, mode }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<ProcessedDocument | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setError(null);

      for (const file of acceptedFiles) {
        if (!isValidFileType(file)) {
          setError(`Unsupported file type: ${file.name}. Please use PDF, DOCX, TXT, or images.`);
          continue;
        }

        if (file.size > 25 * 1024 * 1024) {
          setError(`File too large (max 25MB): ${file.name}`);
          continue;
        }

        setIsProcessing(true);
        try {
          const doc = await processDocument(file, { maxChars: 10000 });
          setUploadedDoc(doc);
          onDocumentProcessed(doc);

          if (doc.extractionStatus === 'failed') {
            setError(doc.errorMessage || 'Failed to process document');
          }
        } catch (err) {
          setError(`Failed to process ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
          setIsProcessing(false);
        }
      }
    },
    [onDocumentProcessed]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    multiple: false,
  });

  const removeFile = () => {
    setUploadedDoc(null);
    setError(null);
  };

  const getFileIcon = (type: ProcessedDocument['type']) => {
    switch (type) {
      case 'pdf':
        return '📄';
      case 'docx':
        return '📝';
      case 'image':
        return '🖼️';
      case 'txt':
        return '📃';
      default:
        return '📎';
    }
  };

  const modeColors: Record<string, string> = {
    document: '#10b981',
    scam: '#ef4444',
    legal: '#f59e0b',
    general: '#3b82f6',
  };

  const color = modeColors[mode] || modeColors.general;

  return (
    <div className="space-y-2">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? 'border-current bg-current/5 scale-[1.02]'
            : 'border-gray-200 hover:border-current hover:bg-current/3'
        }`}
        style={{ borderColor: isDragActive ? color : undefined, color }}
      >
        <input {...getInputProps()} />

        {isProcessing ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: color, borderTopColor: 'transparent' }}
            />
            <p className="text-sm font-medium" style={{ color }}>
              Extracting document text...
            </p>
          </div>
        ) : isDragActive ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="text-2xl">📥</div>
            <p className="text-sm font-medium" style={{ color }}>
              Drop file here!
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${color}15` }}
            >
              <svg
                className="w-4 h-4"
                style={{ color }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div className="text-left flex-1">
              <p className="text-xs font-medium text-gray-600">
                Upload PDF, DOCX, TXT, or image{' '}
                <span className="text-gray-400 font-normal">or drag & drop</span>
              </p>
              <p className="text-xs text-gray-400">Max 25MB • OCR supported</p>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <span className="mt-0.5">⚠️</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-1">
            ×
          </button>
        </div>
      )}

      {/* Uploaded Document Card */}
      {uploadedDoc && (
        <div
          className="p-3 rounded-xl border bg-white"
          style={{ borderColor: `${color}25` }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ backgroundColor: `${color}12` }}
            >
              {getFileIcon(uploadedDoc.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{uploadedDoc.name}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-gray-500">{formatFileSize(uploadedDoc.size)}</span>
                {uploadedDoc.pageCount && (
                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {uploadedDoc.pageCount} page{uploadedDoc.pageCount !== 1 ? 's' : ''}
                  </span>
                )}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    uploadedDoc.extractionStatus === 'success'
                      ? 'bg-green-100 text-green-700'
                      : uploadedDoc.extractionStatus === 'partial'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {uploadedDoc.extractionStatus === 'success'
                    ? '✓ Text extracted'
                    : uploadedDoc.extractionStatus === 'partial'
                    ? '⚠ Partial extraction'
                    : '✗ Extraction failed'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {uploadedDoc.wordCount.toLocaleString()} words •{' '}
                {uploadedDoc.extractionMethod === 'ocr' ? 'OCR used' : 'Text extracted'}
              </p>
            </div>
            <button
              onClick={removeFile}
              className="text-gray-300 hover:text-red-400 transition-colors p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
