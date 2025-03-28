'use client';

import { useState } from 'react';
import { Progress } from '@/components/ui/progress';

interface FileUploadProps {
  onDataExtracted: (data: any) => void;
  onUploadStart?: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onDataExtracted,
  onUploadStart,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const maxFileSize = 5 * 1024 * 1024; // 5 MB limit

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files && event.target.files.length > 0) {
      const selectedFile = event.target.files[0];

      if (selectedFile.size > maxFileSize) {
        alert(
          'File size exceeds the 5MB limit. Please upload a smaller file.'
        );
        setFile(null);
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleUpload = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!file) {
      alert('Please select a file before uploading.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    if (onUploadStart) {
      onUploadStart();
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/extractData', {
        method: 'POST',
        body: formData,
      });

      if (response.status === 413) {
        throw new Error('File size exceeds the server limit.');
      }

      if (!response.ok) throw new Error('Upload failed');

      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        setTimeout(() => setUploadProgress(i), i * 30);
      }

      const data = await response.json();
      onDataExtracted(data);
    } catch (error: any) {
      console.error('Error uploading file:', error.message);
      alert(error.message);
    } finally {
      setUploading(false);
      setUploadProgress(100); // Set progress to 100% on completion
    }
  };

  return (
    <div className="p-8 border rounded-lg shadow-md w-full max-w-md mx-auto flex flex-col items-center gap-2 max-h-fit">
      <form
        action="/api/extractData"
        method="POST"
        encType="multipart/form-data"
        onSubmit={handleUpload}
        className="w-full flex flex-col items-center gap-2"
      >
        <input
          type="file"
          name="file"
          accept=".pdf,.xls,.xlsx,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
          id="file-input"
        />
        <label
          htmlFor="file-input"
          className="bg-gray-200 px-4 py-2 rounded-md cursor-pointer"
        >
          {file ? file.name : 'Choose a file'}
        </label>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-md"
        >
          {uploading ? 'Uploading...' : 'Process File'}
        </button>
      </form>
      {uploading && (
        <Progress value={uploadProgress} className="w-full mt-4" />
      )}
    </div>
  );
};

export default FileUpload;
