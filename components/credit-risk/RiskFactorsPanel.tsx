'use client';

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react';
import type { DebtHealthAssessment } from './types';

interface RiskFactorsPanelProps {
  debtHealth: DebtHealthAssessment | null;
  riskData?: {
    key_risk_factors?: string[];
    positive_factors?: string[];
    recommendations?: string[];
  } | null;
}

// Factor list item component
const FactorItem: React.FC<{
  text: string;
  type: 'risk' | 'positive' | 'recommendation';
}> = ({ text, type }) => {
  const icons = {
    risk: (
      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
    ),
    positive: (
      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
    ),
    recommendation: (
      <Lightbulb className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
    ),
  };

  const styles = {
    risk: 'bg-red-50 border-red-100',
    positive: 'bg-green-50 border-green-100',
    recommendation: 'bg-blue-50 border-blue-100',
  };

  return (
    <div
      className={`flex items-start gap-2 p-2 rounded border ${styles[type]}`}
    >
      {icons[type]}
      <span className="text-sm text-gray-700">{text}</span>
    </div>
  );
};

const RiskFactorsPanel: React.FC<RiskFactorsPanelProps> = ({
  debtHealth,
  riskData,
}) => {
  // Merge factors from both sources
  const riskFactors = [
    ...(debtHealth?.key_risk_factors ?? []),
    ...(riskData?.key_risk_factors ?? []),
  ].filter((v, i, a) => a.indexOf(v) === i); // dedupe

  const positiveFactors = [
    ...(debtHealth?.positive_factors ?? []),
    ...(riskData?.positive_factors ?? []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const recommendations = [
    ...(debtHealth?.recommendations ?? []),
    ...(riskData?.recommendations ?? []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const hasContent =
    riskFactors.length > 0 ||
    positiveFactors.length > 0 ||
    recommendations.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          Risk Factors & Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion
          type="multiple"
          defaultValue={['positive', 'risk']}
          className="w-full"
        >
          {/* Positive Factors */}
          {positiveFactors.length > 0 && (
            <AccordionItem value="positive" className="border-b-0">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-gray-800">
                    Positive Factors ({positiveFactors.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pb-2">
                  {positiveFactors.map((factor, idx) => (
                    <FactorItem
                      key={idx}
                      text={factor}
                      type="positive"
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Risk Factors */}
          {riskFactors.length > 0 && (
            <AccordionItem value="risk" className="border-b-0">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-gray-800">
                    Key Risk Factors ({riskFactors.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pb-2">
                  {riskFactors.map((factor, idx) => (
                    <FactorItem key={idx} text={factor} type="risk" />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <AccordionItem
              value="recommendations"
              className="border-b-0"
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-gray-800">
                    Lending Recommendations ({recommendations.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pb-2">
                  {recommendations.map((rec, idx) => (
                    <FactorItem
                      key={idx}
                      text={rec}
                      type="recommendation"
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        {/* Suggested loan structure if available */}
        {debtHealth?.suggested_loan_structure && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Suggested Loan Structure
            </h4>
            <p className="text-sm text-gray-600 p-3 rounded border border-gray-300">
              {debtHealth.suggested_loan_structure}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RiskFactorsPanel;
