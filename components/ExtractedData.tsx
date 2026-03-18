'use client';


interface ExtractedDataProps {
  data: {
    message: string;
    filename: string;
  } | null;
}

const ExtractedData: React.FC<ExtractedDataProps> = ({ data }) => {
  if (!data) {
    return <p className="text-muted-foreground">No data extracted yet.</p>;
  }

  return (
    <div className="p-4 border border-border rounded-lg shadow-md w-full max-w-md mx-auto mt-4 bg-card">
      <h2 className="text-lg font-semibold">Extracted Data</h2>
      <p className="mt-2 text-sm">
        Filename: <strong>{data.filename}</strong>
      </p>
      <p className="mt-2 text-sm text-success">{data.message}</p>
    </div>
  );
};

export default ExtractedData;
