'use client';

import { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle, CloudUpload, Loader2, FileText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit

const ACCEPTED_FORMATS = [
  { ext: 'PDF', mime: 'application/pdf' },
  { ext: 'Excel', mime: '.xls / .xlsx' },
  { ext: 'Word', mime: '.doc / .docx' },
];

/**
 * Compress a PDF file by re-saving it with pdf-lib.
 * Removes unused objects, optimizes structure, and can reduce file size.
 */
async function compressPDF(file: File): Promise<File> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });

    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    const compressedBlob = new Blob([new Uint8Array(compressedBytes)], { type: 'application/pdf' });
    const compressedFile = new File([compressedBlob], file.name, { type: 'application/pdf' });

    return compressedFile;
  } catch (error) {
    console.warn('PDF compression failed, using original file:', error);
    return file;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const FileUpload: React.FC<FileUploadProps> = ({ onDataExtracted, onUploadStart, projectId }) => {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [stageMessage, setStageMessage] = useState<string>('');
  const [extractedFileName, setExtractedFileName] = useState<string | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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

  // ─────────────────────────────────────────────────────────────────────────
  // File selection & compression
  // ─────────────────────────────────────────────────────────────────────────

  const processFile = async (selectedFile: File) => {
    const originalSize = selectedFile.size;

    if (originalSize > MAX_FILE_SIZE * 3) {
      toast.error('File size exceeds 30MB. Please use a smaller file.');
      return;
    }

    if (stage === 'complete' || stage === 'error') {
      setStage('idle');
      setProgress(0);
      setExtractedFileName(null);
      setCompressionInfo(null);
    }

    if (
      selectedFile.type === 'application/pdf' ||
      selectedFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setStage('compressing');
      setCompressionInfo('Optimizing PDF...');

      const compressedFile = await compressPDF(selectedFile);
      const savedPercent = Math.round((1 - compressedFile.size / originalSize) * 100);

      if (compressedFile.size > MAX_FILE_SIZE) {
        toast.error(
          `File is still ${(compressedFile.size / 1024 / 1024).toFixed(1)}MB after compression. Maximum is 10MB.`
        );
        setStage('idle');
        setCompressionInfo(null);
        return;
      }

      setCompressionInfo(savedPercent > 0 ? `Optimized — saved ${savedPercent}%` : 'Already optimized');
      setFile(compressedFile);
      setStage('idle');
    } else {
      if (originalSize > MAX_FILE_SIZE) {
        toast.error('File size exceeds 10MB limit.');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      await processFile(event.target.files[0]);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Drag & drop handlers
  // ─────────────────────────────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      await processFile(droppedFile);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Upload & SSE stream
  // ─────────────────────────────────────────────────────────────────────────

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      toast.warning('Please select a file.');
      return;
    }

    setStage('processing');
    setProgress(0);
    setCurrentStage('uploading');
    setStageMessage('Starting upload...');
    setExtractedFileName(file.name);
    onUploadStart?.();

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

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: SSEProgress = JSON.parse(line.slice(6));

              setProgress(data.progress);
              setCurrentStage(data.stage);
              setStageMessage(data.message);

              if (data.stage === 'conflict_detected' && data.conflicts) {
                setStage('conflict');
                setYearConflicts(data.conflicts);
                setPendingExtractionId(data.extractionId || null);
                setPendingDocumentId(data.pendingDocumentId || null);
                return;
              }

              if (data.stage === 'complete' && data.data) {
                setStage('complete');
                onDataExtracted(data.data);
              }

              if (data.stage === 'error') {
                setStage('error');
                toast.error(data.message || 'Processing failed');
              }
            } catch {
              // Ignore parse errors on SSE messages
            }
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setStage('error');
        toast.error(error.message);
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Conflict resolution
  // ─────────────────────────────────────────────────────────────────────────

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
      toast.error(error instanceof Error ? error.message : 'Failed to resolve conflicts');
    }
  };

  const handleConflictCancel = async () => {
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

  // ─────────────────────────────────────────────────────────────────────────
  // Derived state
  // ─────────────────────────────────────────────────────────────────────────

  const isProcessing = stage === 'processing';
  const isCompressing = stage === 'compressing';
  const isDisabled = isProcessing || isCompressing;

  const buttonLabel = isCompressing
    ? 'Optimizing...'
    : isProcessing
    ? 'Processing...'
    : stage === 'complete'
    ? 'Process Another'
    : 'Analyze Document';

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

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

      <form onSubmit={handleUpload} className="w-full space-y-4">

        {/* ── Success banner ──────────────────────────────────────────────── */}
        {stage === 'complete' && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-success/10 border border-success/25">
            <CheckCircle className="h-4 w-4 text-success shrink-0" />
            <div className="text-sm min-w-0">
              <span className="font-medium text-foreground">Extraction complete</span>
              {extractedFileName && (
                <span className="text-muted-foreground ml-1 truncate"> — {extractedFileName}</span>
              )}
            </div>
          </div>
        )}

        {/* ── Drop zone ───────────────────────────────────────────────────── */}
        <input
          type="file"
          accept=".pdf,.xls,.xlsx,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
          id="file-input"
          disabled={isDisabled}
        />
        <label
          htmlFor="file-input"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={[
            'flex flex-col items-center justify-center gap-4',
            'w-full min-h-[200px] rounded-xl border-2 border-dashed',
            'cursor-pointer transition-all duration-200 px-6 py-8',
            isDisabled
              ? 'opacity-50 cursor-not-allowed border-border bg-muted/20'
              : isDragging
              ? 'drop-zone-active cursor-copy'
              : file
              ? 'border-success/40 bg-success/5 hover:border-success/60'
              : 'border-border bg-card hover:border-primary/30 hover:bg-primary/[0.03]',
          ].join(' ')}
        >
          {/* Icon */}
          <div
            className={[
              'h-14 w-14 rounded-full flex items-center justify-center transition-colors',
              isDragging
                ? 'bg-[oklch(0.68_0.19_155/0.20)]'
                : file
                ? 'bg-success/10'
                : 'bg-muted',
            ].join(' ')}
          >
            {file ? (
              <FileText
                className="h-6 w-6 text-success"
                strokeWidth={1.5}
              />
            ) : (
              <CloudUpload
                className={[
                  'h-6 w-6 transition-colors',
                  isDragging ? 'text-[oklch(0.68_0.19_155)]' : 'text-muted-foreground',
                ].join(' ')}
                strokeWidth={1.5}
              />
            )}
          </div>

          {/* Text */}
          <div className="text-center space-y-1">
            {isCompressing ? (
              <>
                <p className="text-sm font-medium text-foreground">Optimizing PDF...</p>
                <p className="text-xs text-muted-foreground">Please wait</p>
              </>
            ) : file ? (
              <>
                <p className="text-sm font-medium text-foreground truncate max-w-xs">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                  {compressionInfo && (
                    <span className="text-success ml-1.5">&middot; {compressionInfo}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Click or drag to replace
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  {isDragging ? 'Drop to upload' : 'Drop your file here'}
                </p>
                <p className="text-xs text-muted-foreground">
                  or <span className="text-primary underline underline-offset-2">browse files</span>
                </p>
              </>
            )}
          </div>

          {/* Supported formats */}
          {!file && !isCompressing && (
            <div className="flex items-center gap-2 mt-1">
              {ACCEPTED_FORMATS.map((fmt) => (
                <span
                  key={fmt.ext}
                  className="px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.08em] font-medium border border-border text-muted-foreground bg-muted/50"
                >
                  {fmt.ext}
                </span>
              ))}
              <span className="text-[10px] text-muted-foreground/60">· Max 10 MB</span>
            </div>
          )}
        </label>

        {/* ── Submit button ───────────────────────────────────────────────── */}
        <Button
          type="submit"
          disabled={isDisabled || !file}
          className="w-full gap-2"
          size="lg"
        >
          {isProcessing || isCompressing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {buttonLabel}
        </Button>

        {/* ── Processing progress ─────────────────────────────────────────── */}
        {isProcessing && (
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="font-medium">{STAGE_LABELS[currentStage] || currentStage}</span>
              </div>
              <span className="tabular-nums font-mono">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1" />
            {stageMessage && (
              <p className="text-[11px] text-muted-foreground/70 text-center">{stageMessage}</p>
            )}
          </div>
        )}
      </form>
    </>
  );
};

export default FileUpload;
