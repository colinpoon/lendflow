'use client';

import { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Loader2, FileText, Brain, BarChart3 } from 'lucide-react';

interface FileUploadProps {
  onDataExtracted: (data: any) => void;
  onUploadStart?: () => void;
}

type ProcessingStage =
  | 'idle'
  | 'uploading'
  | 'extracting'
  | 'analyzing'
  | 'generating'
  | 'complete'
  | 'error';

interface StageConfig {
  label: string;
  icon: React.ReactNode;
  progressRange: [number, number];
  estimatedSeconds: number;
}

const STAGE_CONFIG: Record<ProcessingStage, StageConfig> = {
  idle: {
    label: 'Ready to process',
    icon: <FileText className="h-5 w-5" />,
    progressRange: [0, 0],
    estimatedSeconds: 0,
  },
  uploading: {
    label: 'Uploading document...',
    icon: <Loader2 className="h-5 w-5 animate-spin" />,
    progressRange: [0, 15],
    estimatedSeconds: 3,
  },
  extracting: {
    label: 'Extracting text from document...',
    icon: <FileText className="h-5 w-5 animate-pulse" />,
    progressRange: [15, 35],
    estimatedSeconds: 5,
  },
  analyzing: {
    label: 'AI analyzing financial data...',
    icon: <Brain className="h-5 w-5 animate-pulse" />,
    progressRange: [35, 75],
    estimatedSeconds: 15,
  },
  generating: {
    label: 'Generating risk assessment...',
    icon: <BarChart3 className="h-5 w-5 animate-pulse" />,
    progressRange: [75, 95],
    estimatedSeconds: 8,
  },
  complete: {
    label: 'Analysis complete',
    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    progressRange: [100, 100],
    estimatedSeconds: 0,
  },
  error: {
    label: 'Processing failed',
    icon: <FileText className="h-5 w-5 text-red-500" />,
    progressRange: [0, 0],
    estimatedSeconds: 0,
  },
};

const FileUpload: React.FC<FileUploadProps> = ({
  onDataExtracted,
  onUploadStart,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number>(0);
  const [extractedFileName, setExtractedFileName] = useState<string | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const maxFileSize = 5 * 1024 * 1024; // 5 MB limit

  // Calculate total estimated time
  const totalEstimatedTime =
    STAGE_CONFIG.uploading.estimatedSeconds +
    STAGE_CONFIG.extracting.estimatedSeconds +
    STAGE_CONFIG.analyzing.estimatedSeconds +
    STAGE_CONFIG.generating.estimatedSeconds;

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const simulateProgress = (
    fromProgress: number,
    toProgress: number,
    durationMs: number
  ) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    const steps = 20;
    const stepDuration = durationMs / steps;
    const progressStep = (toProgress - fromProgress) / steps;
    let currentStep = 0;

    progressIntervalRef.current = setInterval(() => {
      currentStep++;
      const newProgress = Math.min(
        fromProgress + progressStep * currentStep,
        toProgress
      );
      setUploadProgress(Math.round(newProgress));

      // Update estimated time remaining
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, totalEstimatedTime - elapsed);
      setEstimatedTimeRemaining(Math.ceil(remaining));

      if (currentStep >= steps) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      }
    }, stepDuration);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const selectedFile = event.target.files[0];

      if (selectedFile.size > maxFileSize) {
        alert('File size exceeds the 5MB limit. Please upload a smaller file.');
        setFile(null);
        return;
      }

      setFile(selectedFile);
      // Reset completion state when new file selected
      if (stage === 'complete') {
        setStage('idle');
        setUploadProgress(0);
        setExtractedFileName(null);
      }
    }
  };

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      alert('Please select a file before uploading.');
      return;
    }

    startTimeRef.current = Date.now();
    setEstimatedTimeRemaining(totalEstimatedTime);
    setExtractedFileName(file.name);

    // Stage 1: Uploading
    setStage('uploading');
    setUploadProgress(0);
    simulateProgress(0, 15, STAGE_CONFIG.uploading.estimatedSeconds * 1000);

    if (onUploadStart) {
      onUploadStart();
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Stage 2: Extracting (starts when upload begins server-side)
      setTimeout(() => {
        setStage('extracting');
        simulateProgress(15, 35, STAGE_CONFIG.extracting.estimatedSeconds * 1000);
      }, STAGE_CONFIG.uploading.estimatedSeconds * 1000);

      // Stage 3: Analyzing
      setTimeout(() => {
        setStage('analyzing');
        simulateProgress(35, 75, STAGE_CONFIG.analyzing.estimatedSeconds * 1000);
      }, (STAGE_CONFIG.uploading.estimatedSeconds + STAGE_CONFIG.extracting.estimatedSeconds) * 1000);

      // Stage 4: Generating
      setTimeout(() => {
        setStage('generating');
        simulateProgress(75, 95, STAGE_CONFIG.generating.estimatedSeconds * 1000);
      }, (STAGE_CONFIG.uploading.estimatedSeconds + STAGE_CONFIG.extracting.estimatedSeconds + STAGE_CONFIG.analyzing.estimatedSeconds) * 1000);

      const response = await fetch('/api/extractData', {
        method: 'POST',
        body: formData,
      });

      if (response.status === 413) {
        throw new Error('File size exceeds the server limit.');
      }

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();

      // Complete
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      setStage('complete');
      setUploadProgress(100);
      setEstimatedTimeRemaining(0);
      onDataExtracted(data);
    } catch (error: any) {
      console.error('Error uploading file:', error.message);
      setStage('error');
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      alert(error.message);
    }
  };

  const isProcessing = ['uploading', 'extracting', 'analyzing', 'generating'].includes(stage);
  const currentStageConfig = STAGE_CONFIG[stage];

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `~${seconds}s remaining`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `~${mins}m ${secs}s remaining`;
  };

  return (
    <div className="p-8 border rounded-lg shadow-md w-full max-w-md mx-auto flex flex-col items-center gap-4">
      {/* Completion Banner */}
      {stage === 'complete' && (
        <div className="w-full bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-green-500 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">
              Data Extraction Complete
            </p>
            <p className="text-sm text-green-600">
              {extractedFileName} processed successfully
            </p>
          </div>
        </div>
      )}

      <form
        action="/api/extractData"
        method="POST"
        encType="multipart/form-data"
        onSubmit={handleUpload}
        className="w-full flex flex-col items-center gap-3"
      >
        <input
          type="file"
          name="file"
          accept=".pdf,.xls,.xlsx,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
          id="file-input"
          disabled={isProcessing}
        />
        <label
          htmlFor="file-input"
          className={`bg-gray-200 px-4 py-2 rounded-md cursor-pointer hover:bg-gray-300 transition-colors ${
            isProcessing ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {file ? file.name : 'Choose a file'}
        </label>
        <button
          type="submit"
          disabled={isProcessing || !file}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            isProcessing || !file
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {isProcessing ? 'Processing...' : stage === 'complete' ? 'Process Another File' : 'Process File'}
        </button>
      </form>

      {/* Progress Section */}
      {isProcessing && (
        <div className="w-full space-y-3">
          {/* Progress Bar with Percentage */}
          <div className="relative">
            <Progress value={uploadProgress} className="w-full h-3" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white drop-shadow-md">
                {uploadProgress}%
              </span>
            </div>
          </div>

          {/* Stage Info */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              {currentStageConfig.icon}
              <span>{currentStageConfig.label}</span>
            </div>
            <span className="text-gray-500 text-xs">
              {formatTime(estimatedTimeRemaining)}
            </span>
          </div>

          {/* Stage Progress Indicators */}
          <div className="flex justify-between gap-1">
            {(['uploading', 'extracting', 'analyzing', 'generating'] as ProcessingStage[]).map(
              (s, idx) => {
                const isActive = s === stage;
                const isComplete =
                  ['uploading', 'extracting', 'analyzing', 'generating'].indexOf(stage) > idx;
                return (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      isComplete
                        ? 'bg-green-500'
                        : isActive
                        ? 'bg-blue-500'
                        : 'bg-gray-200'
                    }`}
                  />
                );
              }
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
