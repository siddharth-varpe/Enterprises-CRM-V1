import React, { useMemo } from 'react';

export interface ActivityCurveProps {
  color: 'red' | 'blue' | 'orange' | 'green' | 'purple';
  data?: number[];
  className?: string;
}

const COLOR_MAP = {
  red: {
    stroke: '#DC2626',
    fill: 'url(#grad-red)',
    dot: '#DC2626',
    stop1: 'rgba(220, 38, 38, 0.20)',
    stop2: 'rgba(220, 38, 38, 0.0)',
  },
  blue: {
    stroke: '#0284C7',
    fill: 'url(#grad-blue)',
    dot: '#0284C7',
    stop1: 'rgba(2, 132, 199, 0.20)',
    stop2: 'rgba(2, 132, 199, 0.0)',
  },
  orange: {
    stroke: '#D97706',
    fill: 'url(#grad-orange)',
    dot: '#D97706',
    stop1: 'rgba(217, 119, 6, 0.20)',
    stop2: 'rgba(217, 119, 6, 0.0)',
  },
  green: {
    stroke: '#059669',
    fill: 'url(#grad-green)',
    dot: '#059669',
    stop1: 'rgba(5, 150, 105, 0.20)',
    stop2: 'rgba(5, 150, 105, 0.0)',
  },
  purple: {
    stroke: '#0D9488',
    fill: 'url(#grad-purple)',
    dot: '#0D9488',
    stop1: 'rgba(13, 148, 136, 0.20)',
    stop2: 'rgba(13, 148, 136, 0.0)',
  },
};

// Default flat curve data when no activity exists
const DEFAULT_CURVE_DATA: Record<string, number[]> = {
  red: [0, 0, 0, 0, 0, 0, 0],
  blue: [0, 0, 0, 0, 0, 0, 0],
  orange: [0, 0, 0, 0, 0, 0, 0],
  green: [0, 0, 0, 0, 0, 0, 0],
  purple: [0, 0, 0, 0, 0, 0, 0],
};

export const ActivityCurve: React.FC<ActivityCurveProps> = ({
  color,
  data,
  className = '',
}) => {
  const c = COLOR_MAP[color];
  const pointsData: number[] =
    data !== undefined && data.length > 0
      ? data.length === 1
        ? [data[0], data[0]]
        : data
      : (DEFAULT_CURVE_DATA[color] ?? [0, 0, 0, 0]);

  // Dynamically compute SVG curve path and terminal dot from data points
  const { linePath, areaPath, lastPoint } = useMemo(() => {
    const width = 160;
    const height = 31;
    const paddingX = 0;
    const paddingYTop = 6;
    const paddingYBottom = 6;
    const n = pointsData.length;

    const minVal = Math.min(...pointsData);
    const maxVal = Math.max(...pointsData);
    const range = maxVal - minVal;
    const isAllZero = pointsData.every((v) => v === 0);
    const usableHeight = height - paddingYTop - paddingYBottom;

    // Map each data point to normalized (x, y) coordinates
    const coordinates: Array<{ x: number; y: number }> = pointsData.map((val, i) => {
      const x = paddingX + (i / Math.max(n - 1, 1)) * (width - 2 * paddingX);
      if (isAllZero) {
        return { x, y: height - paddingYBottom };
      }
      const normalizedY = range > 0 ? (val - minVal) / range : 0.5;
      // Invert Y so highest value is at top
      const y = height - paddingYBottom - normalizedY * usableHeight;
      return { x, y };
    });

    if (coordinates.length === 0) {
      return { linePath: '', areaPath: '', lastPoint: { x: 150, y: 15 } };
    }

    const firstCoord = coordinates[0]!;
    // Build smooth cubic Bézier spline across data points
    let d = `M ${firstCoord.x.toFixed(1)},${firstCoord.y.toFixed(1)}`;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const curr = coordinates[i]!;
      const next = coordinates[i + 1]!;
      const cp1x = (curr.x + (next.x - curr.x) / 2).toFixed(1);
      const cp1y = curr.y.toFixed(1);
      const cp2x = (curr.x + (next.x - curr.x) / 2).toFixed(1);
      const cp2y = next.y.toFixed(1);
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x.toFixed(1)},${next.y.toFixed(1)}`;
    }

    const last = coordinates[coordinates.length - 1]!;

    // Closed area beneath line
    const area = `${d} L ${width},${height} L 0,${height} Z`;

    return {
      linePath: d,
      areaPath: area,
      lastPoint: { x: last.x, y: last.y },
    };
  }, [pointsData]);

  return (
    <div className={`w-full h-[31px] overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 160 31"
        preserveAspectRatio="none"
        className="w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.stop1} />
            <stop offset="100%" stopColor={c.stop2} />
          </linearGradient>
        </defs>

        {/* Dynamically Filled Area Beneath Curve */}
        <path d={areaPath} fill={c.fill} />

        {/* Dynamic Smooth Activity Curve Line */}
        <path
          d={linePath}
          fill="none"
          stroke={c.stroke}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dynamic Terminal Endpoint Dot Responsive to Last Data Value */}
        <circle
          cx={Math.min(lastPoint.x - 3, 154)}
          cy={lastPoint.y}
          r="3.2"
          fill={c.dot}
          stroke="#FFFFFF"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
};
