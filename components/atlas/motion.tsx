"use client";

import { motion, type Variants } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/*
 * Atlas motion vocabulary. One easing curve, short durations, tiny
 * distances. A calm instrument easing into position, not bouncy SaaS.
 * Reduced motion is honoured globally by the <MotionConfig> wrapper in
 * app/layout.tsx (reducedMotion="user"), so these components do not each
 * need their own guard.
 */

/** Smooth decelerate: fast onset, long gentle settle. */
export const EASE_ATLAS: [number, number, number, number] = [0.16, 1, 0.3, 1];
/** Symmetric, for two-way motion (active-pill glide, toggles). */
export const EASE_ATLAS_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

/** Durations in seconds (framer-motion). Mirror --dur-* in globals.css. */
export const DUR_FAST = 0.15;
export const DUR = 0.22;
export const DUR_SLOW = 0.34;

/** Fade + small rise. Reserved for overview content and list items. */
export const riseVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR, ease: EASE_ATLAS } },
};

/** Parent variants that stagger children. */
export function makeStagger(stagger = 0.05, delay = 0): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
  };
}

/**
 * Route entrance for the two overview pages only. Repeated operational routes
 * render immediately so moving between tabs stays quiet during continuous use.
 */
export function MotionPage({ children, className }: { children: ReactNode; className?: string }) {
  const pathname = usePathname();
  const isOverview = pathname === "/teach" || pathname === "/student";

  if (!isOverview) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      key={pathname}
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR_SLOW, ease: EASE_ATLAS }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggering container for overview composition. Wrap a grid or list; its
 * children should be <MotionItem>.
 */
export function StaggerGrid({
  children,
  className,
  stagger = 0.05,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={makeStagger(stagger, delay)}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

/** A staggered overview child: fade + rise, inheriting timing from its parent. */
export function MotionItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={riseVariants}>
      {children}
    </motion.div>
  );
}

/**
 * A pressable wrapper: tactile scale-down on tap. Wrap any button or
 * clickable card. Reduced motion is honoured by MotionConfig above.
 */
export function Pressable({
  children,
  className,
  scale = 0.97,
}: {
  children: ReactNode;
  className?: string;
  scale?: number;
}) {
  return (
    <motion.div
      className={className}
      whileTap={{ scale }}
      transition={{ duration: DUR_FAST, ease: EASE_ATLAS }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Hover lift for interactive cards. 1px rise + elevated shadow on hover,
 * press-down on tap. Pairs with the .atlas-card-hover CSS class but gives
 * finer control when you need JS-driven motion.
 */
export const cardHoverProps = {
  whileHover: { y: -2 },
  whileTap: { y: 0, scale: 0.99 },
  transition: { duration: DUR, ease: EASE_ATLAS },
} as const;
