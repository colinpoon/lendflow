'use client';

interface EBITDAData {
  netIncome: number;
  interest: number;
  taxes: number;
  depreciation: number;
  amortization: number;
}

interface EBITDAProps {
  data: EBITDAData | null;
}

const EBITDA: React.FC<EBITDAProps> = ({ data }) => {
  if (!data) {
    return <p className="text-gray-500">EBITDA data unavailable.</p>;
  }

  const { netIncome, interest, taxes, depreciation, amortization } =
    data;
  const ebitda =
    netIncome + interest + taxes + depreciation + amortization;

  return (
    <div className="p-4 border rounded-lg shadow-md w-full max-w-lg mx-auto mt-4">
      <h2 className="text-lg font-semibold mb-2">
        EBITDA Calculation
      </h2>
      <p className="text-gray-700">
        EBITDA: <strong>${ebitda.toLocaleString()}</strong>
      </p>
    </div>
  );
};

export default EBITDA;
