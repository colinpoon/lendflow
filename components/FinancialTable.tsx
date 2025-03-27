'use client';

interface FinancialData {
  netIncome: number;
  expenses: number;
  profitMargin: number;
  interest: number;
  taxes: number;
  depreciation: number;
  amortization: number;
}

interface FinancialTableProps {
  data: FinancialData | null;
}

const FinancialTable: React.FC<FinancialTableProps> = ({ data }) => {
  if (!data) {
    return (
      <p className="text-gray-500">No financial data available.</p>
    );
  }

  return (
    <div className="p-4 border rounded-lg shadow-md w-full max-w-lg mx-auto mt-4">
      <h2 className="text-lg font-semibold mb-2">
        Financial Metrics
      </h2>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Metric</th>
            <th className="border p-2">Value</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data).map(([key, value]) => (
            <tr key={key}>
              <td className="border p-2 capitalize">
                {key.replace(/([A-Z])/g, ' $1')}
              </td>
              <td className="border p-2">
                ${value.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FinancialTable;
