'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

interface GridOverlayProps {
  children: React.ReactNode;
  className?: string;
  enableParallax?: boolean;
}

export function GridOverlay({
  children,
  className = '',
  enableParallax = true,
}: GridOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 20]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {enableParallax ? (
        <motion.div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            y,
            backgroundImage: `
              linear-gradient(oklch(0.75 0.15 195 / 5%) 1px, transparent 1px),
              linear-gradient(90deg, oklch(0.75 0.15 195 / 5%) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
      ) : (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `
              linear-gradient(oklch(0.75 0.15 195 / 5%) 1px, transparent 1px),
              linear-gradient(90deg, oklch(0.75 0.15 195 / 5%) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
