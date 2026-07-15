'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

interface MotionRevealProps {
  children: ReactNode;
  /** Travel direction of the reveal. Default 'up'. */
  direction?: Direction;
  /** Travel distance in px. Default 24. */
  distance?: number;
  /** Animation duration in seconds. Default 0.6. */
  duration?: number;
  /** Stagger delay in seconds. Default 0. */
  delay?: number;
  /** Re-run every time it enters the viewport (true) or only once (false, default). */
  once?: boolean;
  /** Render as a different element, e.g. 'li'. Defaults to div. */
  as?: 'div' | 'section' | 'li' | 'span';
  className?: string;
}

const offset = (direction: Direction, distance: number) => {
  switch (direction) {
    case 'up':    return { y: distance };
    case 'down':  return { y: -distance };
    case 'left':  return { x: distance };
    case 'right': return { x: -distance };
    default:      return {};
  }
};

/**
 * Thin scroll-reveal wrapper around framer-motion.
 * Respects prefers-reduced-motion: falls back to an opacity-only fade so
 * content still appears, just without travel transforms.
 */
export default function MotionReveal({
  children,
  direction = 'up',
  distance = 24,
  duration = 0.6,
  delay = 0,
  once = true,
  as = 'div',
  className,
}: MotionRevealProps) {
  const prefersReduced = useReducedMotion();

  const variants: Variants = {
    hidden: prefersReduced ? { opacity: 0 } : { opacity: 0, ...offset(direction, distance) },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration, delay, ease: [0.22, 1, 0.36, 1] },
    },
  };

  const MotionTag = motion[as];

  return (
    <MotionTag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-80px' }}
    >
      {children}
    </MotionTag>
  );
}
