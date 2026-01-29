'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle, Loader2, Upload, FileText } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

interface FileUploadProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDataExtracted: (data: any) => void;
  onUploadStart?: () => void;
}

type ProcessingStage = 'idle' | 'compressing' | 'processing' | 'complete' | 'error';

const STAGES = ['Compressing', 'Uploading', 'Extracting', 'Analyzing', 'Finalizing'];
const TOTAL_ESTIMATED_SECONDS = 35;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

/**
 * Compress a PDF file by re-saving it with pdf-lib
 */
async function compressPDF(file: File): Promise<File> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
      updateMetadata: false
    });

    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    const compressedBlob = new Blob([compressedBytes], { type: 'application/pdf' });
    const compressedFile = new File([compressedBlob], file.name, { type: 'application/pdf' });

    return compressedFile;
  } catch (error) {
    console.warn('PDF compression failed, using original file:', error);
    return file;
  }
}

const FileUpload: React.FC<FileUploadProps> = ({
  onDataExtracted,
  onUploadStart,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [extractedFileName, setExtractedFileName] = useState<string | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startProgressSimulation = () => {
    const startTime = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const newProgress = Math.min(95, (elapsed / TOTAL_ESTIMATED_SECONDS) * 100);

      setProgress(Math.round(newProgress));
      setTimeRemaining(Math.max(0, Math.ceil(TOTAL_ESTIMATED_SECONDS - elapsed)));
      setCurrentStageIndex(Math.min(3, Math.floor(newProgress / 25)));
    }, 200);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      const selectedFile = event.target.files[0];
      const originalSize = selectedFile.size;

      if (originalSize > MAX_FILE_SIZE * 3) {
        alert('File size exceeds 30MB. Please use a smaller file.');
        return;
      }

      if (stage === 'complete' || stage === 'error') {
        setStage('idle');
        setProgress(0);
        setExtractedFileName(null);
        setCompressionInfo(null);
      }

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

        if (savedPercent > 5) {
          setCompressionInfo(`Optimized: saved ${savedPercent}%`);
        } else {
          setCompressionInfo(null);
        }

        setFile(compressedFile);
        setStage('idle');
      } else {
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
    setTimeRemaining(TOTAL_ESTIMATED_SECONDS);
    setExtractedFileName(file.name);
    startProgressSimulation();
    onUploadStart?.();

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/extractData', {
        method: 'POST',
        body: formData,
      });

      if (response.status === 413) throw new Error('File too large.');
      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();

      if (intervalRef.current) clearInterval(intervalRef.current);
      setStage('complete');
      setProgress(100);
      setTimeRemaining(0);
      onDataExtracted(data);
    } catch (error) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setStage('error');
      alert(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const isProcessing = stage === 'processing';
  const isCompressing = stage === 'compressing';

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Success State */}
      {stage === 'complete' && (
        <div className="flex items-center gap-3 p-4 rounded-md border border-success/30 bg-success/5">
          <CheckCircle className="h-5 w-5 text-success" />
          <div className="text-sm">
            <span className="font-medium text-success">Extraction Complete</span>
            <span className="text-muted-foreground ml-2">{extractedFileName}</span>
          </div>
        </div>
      )}

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="flex flex-col items-center gap-4">
        <input
          type="file"
          accept=".pdf,.xls,.xlsx,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
          id="file-input"
          disabled={isProcessing || isCompressing}
          aria-label="Select file to upload"
        />
        <label
          htmlFor="file-input"
          className={`w-full p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors duration-150
            ${isProcessing || isCompressing
              ? 'opacity-50 cursor-not-allowed border-muted'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
            }`}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            {file ? (
              <>
                <FileText className="h-10 w-10 text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {compressionInfo && !isCompressing && (
                    <p className="text-xs text-success">{compressionInfo}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {isCompressing ? 'Optimizing PDF...' : 'Click to select a file'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, XLS, XLSX, DOC, DOCX supported
                  </p>
                </div>
              </>
            )}
          </div>
        </label>

        <button
          type="submit"
          disabled={isProcessing || isCompressing || !file}
          className={`w-full py-3 px-4 rounded-md text-sm font-medium transition-colors duration-150
            ${isProcessing || isCompressing || !file
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
        >
          {isCompressing ? 'Optimizing...' : isProcessing ? 'Processing...' : stage === 'complete' ? 'Process Another File' : 'Process File'}
        </button>
      </form>

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-3" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{STAGES[currentStageIndex]}</span>
            </div>
            <span>{progress}% · ~{timeRemaining}s remaining</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200 rounded-full"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
