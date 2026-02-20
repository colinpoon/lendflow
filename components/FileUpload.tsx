'use client';

import { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Loader2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { YearConflictDialog } from '@/components/YearConflictDialog';
import type { YearConflict, ConflictResolution } from '@/lib/extraction-utils';

interface FileUploadProps {
  onDataExtracted: (data: Record<string, unknown>) => void;
  onUploadStart?: () => void;
  projectId?: string;
}

type ProcessingStage = 'idle' | 'compressing' | 'processing' | 'conflict' | 'complete' | 'error';

interface SSEProgress {
  stage: string;
  progress: number;
  message: string;
  chunk?: number;
  totalChunks?: number;
  data?: Record<string, unknown>;
  conflicts?: YearConflict[];
  extractionId?: string;
  pendingDocumentId?: string;
}

const STAGE_LABELS: Record<string, string> = {
  uploading: 'Uploading',
  parsing: 'Parsing',
  chunking: 'Chunking',
  extracting: 'Extracting',
  merging: 'Merging',
  computing: 'Computing',
  validating: 'Validating',
  assessing: 'Assessing',
  saving: 'Saving',
  complete: 'Complete',
  error: 'Error',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

/**
 * Compress a PDF file by re-saving it with pdf-lib
 * This removes unused objects, optimizes structure, and can reduce file size
 */
async function compressPDF(file: File): Promise<File> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
      updateMetadata: false
    });

    // Save with optimization - this removes unused objects
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    // Convert Uint8Array to ArrayBuffer for Blob compatibility
    const compressedBlob = new Blob([new Uint8Array(compressedBytes)], { type: 'application/pdf' });
    const compressedFile = new File([compressedBlob], file.name, { type: 'application/pdf' });

    console.log(`📄 PDF compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);

    return compressedFile;
  } catch (error) {
    console.warn('⚠️ PDF compression failed, using original file:', error);
    return file;
  }
}

const FileUpload: React.FC<FileUploadProps> = ({
  onDataExtracted,
  onUploadStart,
  projectId,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [stageMessage, setStageMessage] = useState<string>('');
  const [extractedFileName, setExtractedFileName] = useState<string | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Conflict handling state
  const [yearConflicts, setYearConflicts] = useState<YearConflict[] | null>(null);
  const [pendingExtractionId, setPendingExtractionId] = useState<string | null>(null);
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      const selectedFile = event.target.files[0];
      const originalSize = selectedFile.size;

      if (originalSize > MAX_FILE_SIZE * 3) {
        // Reject files over 30MB even before compression
        alert('File size exceeds 30MB. Please use a smaller file.');
        return;
      }

      // Reset state
      if (stage === 'complete' || stage === 'error') {
        setStage('idle');
        setProgress(0);
        setExtractedFileName(null);
        setCompressionInfo(null);
      }

      // Compress PDF files
      if (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setStage('compressing');
        setCompressionInfo('Optimizing PDF...');

        const compressedFile = await compressPDF(selectedFile);
        const savedPercent = Math.round((1 - compressedFile.size / originalSize) * 100);

        if (compressedFile.size > MAX_FILE_SIZE) {
          alert(`File is still ${(compressedFile.size / 1024 / 1024).toFixed(1)}MB after compression. Maximum is 10MB.`);
          setStage('idle');
          setCompressionInfo(null);
          return;
        }

        if (savedPercent > 0) {
          setCompressionInfo(`Optimized: saved ${savedPercent}%`);
        } else {
          setCompressionInfo('Already optimized');
        }

        setFile(compressedFile);
        setStage('idle');
      } else {
        // Non-PDF files
        if (originalSize > MAX_FILE_SIZE) {
          alert('File size exceeds 10MB limit.');
          return;
        }
        setFile(selectedFile);
      }
    }
  };

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      alert('Please select a file.');
      return;
    }

    setStage('processing');
    setProgress(0);
    setCurrentStage('uploading');
    setStageMessage('Starting upload...');
    setExtractedFileName(file.name);
    onUploadStart?.();

    // Create abort controller for cleanup
    abortControllerRef.current = new AbortController();

    const formData = new FormData();
    formData.append('file', file);
    if (projectId) {
      formData.append('projectId', projectId);
    }

    try {
      const response = await fetch('/api/extractData', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (response.status === 413) throw new Error('File too large.');
      if (!response.ok) throw new Error('Upload failed');

      // Read SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE messages (format: "data: {...}\n\n")
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete message in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: SSEProgress = JSON.parse(line.slice(6));

              // Update UI with progress
              setProgress(data.progress);
              setCurrentStage(data.stage);
              setStageMessage(data.message);

              // Handle conflict detection
              if (data.stage === 'conflict_detected' && data.conflicts) {
                setStage('conflict');
                setYearConflicts(data.conflicts);
                setPendingExtractionId(data.extractionId || null);
                setPendingDocumentId(data.pendingDocumentId || null);
                // Don't proceed - wait for user resolution
                return;
              }

              // Handle completion
              if (data.stage === 'complete' && data.data) {
                setStage('complete');
                onDataExtracted(data.data);
              }

              // Handle error
              if (data.stage === 'error') {
                setStage('error');
                alert(data.message || 'Processing failed');
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setStage('error');
        alert(error.message);
      }
    }
  };

  const isProcessing = stage === 'processing';
  const isCompressing = stage === 'compressing';

  // Handle conflict resolution
  const handleConflictResolve = async (resolutions: ConflictResolution) => {
    if (!pendingExtractionId || !projectId) {
      console.error('Missing extraction ID or project ID for conflict resolution');
      setYearConflicts(null);
      setStage('error');
      return;
    }

    setStage('processing');
    setCurrentStage('merging');
    setStageMessage('Applying conflict resolutions...');
    setProgress(90);

    try {
      const response = await fetch('/api/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractionId: pendingExtractionId,
          projectId,
          resolutions,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to apply conflict resolutions');
      }

      const result = await response.json();

      setYearConflicts(null);
      setPendingExtractionId(null);
      setPendingDocumentId(null);
      setStage('complete');
      onDataExtracted(result.data);
    } catch (error: unknown) {
      setStage('error');
      alert(error instanceof Error ? error.message : 'Failed to resolve conflicts');
    }
  };

  const handleConflictCancel = async () => {
    // User cancelled - optionally delete the pending extraction
    if (pendingExtractionId) {
      try {
        await fetch('/api/resolve-conflict', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            extractionId: pendingExtractionId,
            documentId: pendingDocumentId,
          }),
        });
      } catch {
        // Ignore cleanup errors
      }
    }

    setYearConflicts(null);
    setPendingExtractionId(null);
    setPendingDocumentId(null);
    setStage('idle');
    setProgress(0);
  };

  return (
    <>
    {/* Year Conflict Dialog */}
    {yearConflicts && yearConflicts.length > 0 && (
      <YearConflictDialog
        open={stage === 'conflict'}
        conflicts={yearConflicts}
        onResolve={handleConflictResolve}
        onCancel={handleConflictCancel}
      />
    )}

    <div className="p-6 border border-border rounded-lg shadow-sm w-full max-w-md mx-auto space-y-4">
      {/* Success State */}
      {stage === 'complete' && (
        <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/25 rounded-md">
          <CheckCircle className="h-5 w-5 text-success" />
          <div className="text-sm">
            <span className="font-medium text-foreground">Extraction Complete</span>
            <span className="text-muted-foreground ml-1">— {extractedFileName}</span>
          </div>
        </div>
      )}

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="flex flex-col items-center gap-3">
        <input
          type="file"
          accept=".pdf,.xls,.xlsx,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
          id="file-input"
          disabled={isProcessing || isCompressing}
        />
        <label
          htmlFor="file-input"
          className={`w-full text-center py-3 px-4 border-2 border-dashed rounded-md cursor-pointer transition-colors
            ${isProcessing || isCompressing
              ? 'opacity-50 cursor-not-allowed border-border'
              : 'border-border hover:border-primary/30 hover:bg-primary/5'}`}
        >
          <span className="text-sm text-muted-foreground">
            {isCompressing ? 'Optimizing PDF...' : file ? file.name : 'Click to select a file'}
          </span>
          {compressionInfo && !isCompressing && (
            <span className="block text-xs text-success mt-1">{compressionInfo}</span>
          )}
        </label>

        <button
          type="submit"
          disabled={isProcessing || isCompressing || !file}
          className={`w-full py-2 rounded-md font-medium text-sm transition-colors
            ${isProcessing || isCompressing || !file
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
        >
          {isCompressing ? 'Optimizing...' : isProcessing ? 'Processing...' : stage === 'complete' ? 'Process Another' : 'Process File'}
        </button>
      </form>

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{STAGE_LABELS[currentStage] || currentStage}</span>
            </div>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground/70 text-center">{stageMessage}</p>
        </div>
      )}
    </div>
    </>
  );
};

export default FileUpload;
