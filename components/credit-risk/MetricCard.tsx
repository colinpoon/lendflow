'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
} from 'lucide-react';
import type { HealthConfig } from './types';
import { getHealthLabel, formatChange } from './utils';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  id: string;
  title: string;
  value: string;
  health: HealthConfig;
  target: string;
  tooltip: string;
  sparklineData?: number[];
  trend?: {
    direction: 'improving' | 'stable' | 'worsening' | null;
    change: number | null;
  };
  isExpanded?: boolean;
  expandedCard?: string | null;
  onExpand?: () => void;
  onCollapse?: () => void;
  breakdownTitle?: string;
  breakdownSubtitle?: string;
  breakdownContent?: React.ReactNode;
}

// Mini sparkline chart component
const Sparkline: React.FC<{
  data: number[];
  color: string;
  width?: number;
  height?: number;
}> = ({ data, color, width = 80, height = 24 }) => {
  if (data.length === 0) return null;

  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x =
        padding + (index / (data.length - 1 || 1)) * chartWidth;
      const y =
        padding + chartHeight - ((value - min) / range) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="opacity-80">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {data.length > 0 && (
        <circle
          cx={padding + chartWidth}
          cy={
            padding +
            chartHeight -
            ((data[data.length - 1] - min) / range) * chartHeight
          }
          r="3"
          fill={color}
        />
      )}
    </svg>
  );
};

// Trend indicator icon
const TrendIndicator: React.FC<{
  direction: 'improving' | 'stable' | 'worsening' | null;
}> = ({ direction }) => {
  if (direction === 'improving') {
    return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  }
  if (direction === 'worsening') {
    return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  }
  return <Minus className="h-3.5 w-3.5 text-gray-400" />;
};

const MetricCard: React.FC<MetricCardProps> = ({
  id,
  title,
  value,
  health,
  target,
  tooltip,
  sparklineData,
  trend,
  isExpanded = false,
  expandedCard,
  onExpand,
  onCollapse,
  breakdownTitle,
  breakdownSubtitle,
  breakdownContent,
}) => {
  // Determine if this card should be hidden (another card is expanded)
  const isHidden = expandedCard !== null && expandedCard !== id;

  return (
    <TooltipProvider>
      <Card
        className={cn(
          'relative overflow-hidden transition-all duration-300 ease-in-out',
          isExpanded
            ? 'col-span-1 sm:col-span-2 lg:col-span-4 shadow-lg'
            : 'col-span-1 hover:shadow-md',
          isHidden &&
            'opacity-0 scale-95 pointer-events-none absolute',
        )}
      >
        <CardContent className={cn('p-4', isExpanded && 'p-6')}>
          {isExpanded ? (
            // Expanded view
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {breakdownTitle}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {breakdownSubtitle}
                  </p>
                </div>
                <button
                  onClick={onCollapse}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Close details"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Breakdown Content */}
              <div className="mt-4">{breakdownContent}</div>
            </div>
          ) : (
            // Collapsed view (original card content)
            <>
              {/* Header with title and info */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {title}
                  </span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs">{tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {trend && trend.direction && (
                  <div className="flex items-center gap-1">
                    <TrendIndicator direction={trend.direction} />
                    <span
                      className={`text-xs font-medium ${
                        trend.direction === 'improving'
                          ? 'text-green-600'
                          : trend.direction === 'worsening'
                            ? 'text-red-600'
                            : 'text-gray-500'
                      }`}
                    >
                      {formatChange(trend.change)}
                    </span>
                  </div>
                )}
              </div>

              {/* Value */}
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-gray-900">
                  {value}
                </span>
              </div>

              {/* Sparkline */}
              {sparklineData && sparklineData.length > 1 && (
                <div className="mb-2">
                  <Sparkline
                    data={sparklineData}
                    color={health.color}
                  />
                </div>
              )}

              {/* Health badge and target */}
              <div className="flex items-center justify-between">
                <Badge
                  variant="secondary"
                  className={`${health.bgClass} text-white text-xs font-medium`}
                >
                  {getHealthLabel(health.level)}
                </Badge>
                <span className="text-xs text-gray-400">
                  {target}
                </span>
              </div>

              {/* Details button */}
              {onExpand && (
                <button
                  onClick={onExpand}
                  className="mt-3 w-full text-xs text-center text-gray-700 hover:text-gray-900 font-medium py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  View Details
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default MetricCard;
