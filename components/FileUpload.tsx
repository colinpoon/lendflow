'use client';

import { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Loader2 } from 'lucide-react';

interface FileUploadProps {
  onDataExtracted: (data: any) => void;
  onUploadStart?: () => void;
}

type ProcessingStage = 'idle' | 'processing' | 'complete' | 'error';

const STAGES = ['Uploading', 'Extracting', 'Analyzing', 'Finalizing'];
const TOTAL_ESTIMATED_SECONDS = 30;

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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxFileSize = 5 * 1024 * 1024;

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      const selectedFile = event.target.files[0];
      if (selectedFile.size > maxFileSize) {
        alert('File size exceeds 5MB limit.');
        return;
      }
      setFile(selectedFile);
      if (stage === 'complete') {
        setStage('idle');
        setProgress(0);
        setExtractedFileName(null);
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
    } catch (error: any) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setStage('error');
      alert(error.message);
    }
  };

  const isProcessing = stage === 'processing';

  return (
    <div className="p-6 border rounded-lg shadow-sm w-full max-w-md mx-auto space-y-4">
      {/* Success State */}
      {stage === 'complete' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <div className="text-sm">
            <span className="font-medium text-green-800">Extraction Complete</span>
            <span className="text-green-600 ml-1">— {extractedFileName}</span>
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
          disabled={isProcessing}
        />
        <label
          htmlFor="file-input"
          className={`w-full text-center py-3 px-4 border-2 border-dashed rounded-md cursor-pointer transition-colors
            ${isProcessing ? 'opacity-50 cursor-not-allowed border-gray-200' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
        >
          <span className="text-sm text-gray-600">
            {file ? file.name : 'Click to select a file'}
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
          {isProcessing ? 'Processing...' : stage === 'complete' ? 'Process Another' : 'Process File'}
        </button>
      </form>

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{STAGES[currentStageIndex]}</span>
            </div>
            <span>{progress}% · ~{timeRemaining}s</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}
    </div>
  );
};

export default FileUpload;
