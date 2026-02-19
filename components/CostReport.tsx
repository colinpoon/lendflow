'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  model: string;
  cost_usd?: number;
}

interface CostReportProps {
  textUsage: TokenUsage | null;
  visionUsage: TokenUsage | null;
}

export function CostReport({ textUsage, visionUsage }: CostReportProps) {
  const textCost = textUsage?.cost_usd ?? 0;
  const visionCost = visionUsage?.cost_usd ?? 0;
  const costRatio = textCost > 0 ? visionCost / textCost : 0;
  const withinTarget = costRatio < 2; // Target: vision < 2x text cost

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <h4 className="font-medium">Text Extraction (GPT-4 Turbo)</h4>
            {textUsage ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Input: {textUsage.input_tokens.toLocaleString()} tokens
                </p>
                <p className="text-sm text-muted-foreground">
                  Output: {textUsage.output_tokens.toLocaleString()} tokens
                </p>
                <p className="text-lg font-bold text-blue-600">
                  ${textCost.toFixed(4)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Vision Extraction (Claude Sonnet 4)</h4>
            {visionUsage ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Input: {visionUsage.input_tokens.toLocaleString()} tokens
                </p>
                <p className="text-sm text-muted-foreground">
                  Output: {visionUsage.output_tokens.toLocaleString()} tokens
                </p>
                <p className="text-lg font-bold text-green-600">
                  ${visionCost.toFixed(4)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </div>
        </div>

        {textUsage && visionUsage && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm">
              Vision is <span className="font-bold">{costRatio.toFixed(2)}x</span> the cost of text extraction.
              {withinTarget ? (
                <span className="text-green-600 ml-2">Within 2x target</span>
              ) : (
                <span className="text-red-600 ml-2">Exceeds 2x target</span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
