'use client';

import { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

import type { UploadCompletePayload } from '@/components/FileUpload';

interface VisionFileUploadProps {
  onDataExtracted: (data: UploadCompletePayload) => void;
  onUploadStart?: () => void;
  projectId?: string;
}

type ProcessingStage = 'idle' | 'processing' | 'complete' | 'error';

interface SSEProgress {
  stage: string;
  progress: number;
  message: string;
  data?: UploadCompletePayload;
}

const STAGE_LABELS: Record<string, string> = {
  uploading: 'Uploading',
  extracting: 'Extracting (Vision)',
  computing: 'Computing Ratios',
  saving: 'Saving',
  complete: 'Complete',
  error: 'Error',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

const VisionFileUpload: React.FC<VisionFileUploadProps> = ({
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      const selectedFile = event.target.files[0];
      setErrorMessage(null);

      // Check if it's a PDF
      if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setErrorMessage('Vision extraction only supports PDF files.');
        return;
      }

      if (selectedFile.size > MAX_FILE_SIZE) {
        setErrorMessage('File size exceeds 10MB limit.');
        return;
      }

      // Reset state
      if (stage === 'complete' || stage === 'error') {
        setStage('idle');
        setProgress(0);
        setExtractedFileName(null);
      }

      setFile(selectedFile);
    }
  };

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setErrorMessage('Please select a PDF file.');
      return;
    }

    setStage('processing');
    setProgress(0);
    setCurrentStage('uploading');
    setStageMessage('Starting upload...');
    setExtractedFileName(file.name);
    setErrorMessage(null);
    onUploadStart?.();

    // Create abort controller for cleanup
    abortControllerRef.current = new AbortController();

    const formData = new FormData();
    formData.append('file', file);
    if (projectId) {
      formData.append('projectId', projectId);
    }

    try {
      const response = await fetch('/api/extractData/vision', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (response.status === 400) {
        const error = await response.json();
        throw new Error(error.error || 'Invalid request');
      }
      if (response.status === 401) {
        throw new Error('Please sign in to use vision extraction.');
      }
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

              // Handle completion
              if (data.stage === 'complete' && data.data) {
                setStage('complete');
                onDataExtracted(data.data);
              }

              // Handle error
              if (data.stage === 'error') {
                setStage('error');
                setErrorMessage(data.message || 'Processing failed');
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
        setErrorMessage(error.message);
      }
    }
  };

  const isProcessing = stage === 'processing';

  return (
    <div className="p-6 border rounded-lg shadow-sm w-full max-w-md mx-auto space-y-4">
      {/* Vision Badge */}
      <div className="flex items-center justify-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-md py-2">
        <span className="font-medium">Claude Vision Extraction</span>
        <span className="text-xs text-blue-500">(PDF only)</span>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-sm text-red-800">{errorMessage}</span>
        </div>
      )}

      {/* Success State */}
      {stage === 'complete' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <div className="text-sm">
            <span className="font-medium text-green-800">Vision Extraction Complete</span>
            <span className="text-green-600 ml-1">— {extractedFileName}</span>
          </div>
        </div>
      )}

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="flex flex-col items-center gap-3">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
          id="vision-file-input"
          disabled={isProcessing}
        />
        <label
          htmlFor="vision-file-input"
          className={`w-full text-center py-3 px-4 border-2 border-dashed rounded-md cursor-pointer transition-colors
            ${isProcessing ? 'opacity-50 cursor-not-allowed border-gray-200' : 'border-blue-300 hover:border-blue-400 hover:bg-blue-50'}`}
        >
          <span className="text-sm text-gray-600">
            {file ? file.name : 'Click to select a PDF file'}
          </span>
        </label>

        <button
          type="submit"
          disabled={isProcessing || !file}
          className={`w-full py-2 rounded-md font-medium text-sm transition-colors
            ${isProcessing || !file
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'}`}
        >
          {isProcessing ? 'Processing with Vision...' : stage === 'complete' ? 'Process Another' : 'Extract with Vision'}
        </button>
      </form>

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{STAGE_LABELS[currentStage] || currentStage}</span>
            </div>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-gray-400 text-center">{stageMessage}</p>
        </div>
      )}
    </div>
  );
};

export default VisionFileUpload;
