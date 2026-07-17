"use client";

import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { memo, useMemo } from "react";

const motionComponents = {
  div: motion.div,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  p: motion.p,
  span: motion.span,
};

type ShimmerElement = keyof typeof motionComponents;

export interface TextShimmerProps {
  children: string;
  as?: ShimmerElement;
  className?: string;
  duration?: number;
  spread?: number;
}

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const shouldReduceMotion = useReducedMotion();
  const MotionComponent = motionComponents[Component];

  const dynamicSpread = useMemo(
    () => (children?.length ?? 0) * spread,
    [children, spread]
  );

  return (
    <MotionComponent
      animate={shouldReduceMotion ? undefined : { backgroundPosition: "0% center" }}
      className={cn(
        "relative inline-block",
        shouldReduceMotion
          ? "text-[var(--color-muted)]"
          : "bg-[length:250%_100%,auto] bg-clip-text text-transparent [--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-ink),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]",
        className
      )}
      initial={shouldReduceMotion ? undefined : { backgroundPosition: "100% center" }}
      style={
        shouldReduceMotion
          ? undefined
          : ({
              "--spread": `${dynamicSpread}px`,
              backgroundImage:
                "var(--bg), linear-gradient(var(--color-faint), var(--color-faint))",
            } as CSSProperties)
      }
      transition={
        shouldReduceMotion
          ? undefined
          : {
              duration,
              ease: "linear",
              repeat: Number.POSITIVE_INFINITY,
            }
      }
    >
      {children}
    </MotionComponent>
  );
};

export const Shimmer = memo(ShimmerComponent);
