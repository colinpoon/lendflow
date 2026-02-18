'use client';


interface ExtractedDataProps {
  data: {
    message: string;
    filename: string;
  } | null;
}

const ExtractedData: React.FC<ExtractedDataProps> = ({ data }) => {
  if (!data) {
    return <p className="text-gray-500">No data extracted yet.</p>;
  }

  return (
    <div className="p-4 border rounded-lg shadow-md w-full max-w-md mx-auto mt-4">
      <h2 className="text-lg font-semibold">Extracted Data</h2>
      <p className="mt-2 text-sm">
        Filename: <strong>{data.filename}</strong>
      </p>
      <p className="mt-2 text-sm text-green-600">{data.message}</p>
    </div>
  );
};

export default ExtractedData;
