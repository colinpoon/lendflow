'use client';

import { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Loader2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

interface FileUploadProps {
  onDataExtracted: (data: any) => void;
  onUploadStart?: () => void;
}

type ProcessingStage = 'idle' | 'compressing' | 'processing' | 'complete' | 'error';

const STAGES = ['Compressing', 'Uploading', 'Extracting', 'Analyzing', 'Finalizing'];
const TOTAL_ESTIMATED_SECONDS = 35;
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

    const compressedBlob = new Blob([compressedBytes], { type: 'application/pdf' });
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

        if (savedPercent > 5) {
          setCompressionInfo(`Optimized: saved ${savedPercent}%`);
        } else {
          setCompressionInfo(null);
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
  const isCompressing = stage === 'compressing';

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
          disabled={isProcessing || isCompressing}
        />
        <label
          htmlFor="file-input"
          className={`w-full text-center py-3 px-4 border-2 border-dashed rounded-md cursor-pointer transition-colors
            ${isProcessing || isCompressing ? 'opacity-50 cursor-not-allowed border-gray-200' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
        >
          <span className="text-sm text-gray-600">
            {isCompressing ? 'Optimizing PDF...' : file ? file.name : 'Click to select a file'}
          </span>
          {compressionInfo && !isCompressing && (
            <span className="block text-xs text-green-600 mt-1">{compressionInfo}</span>
          )}
        </label>

        <button
          type="submit"
          disabled={isProcessing || isCompressing || !file}
          className={`w-full py-2 rounded-md font-medium text-sm transition-colors
            ${isProcessing || isCompressing || !file
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'}`}
        >
          {isCompressing ? 'Optimizing...' : isProcessing ? 'Processing...' : stage === 'complete' ? 'Process Another' : 'Process File'}
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
