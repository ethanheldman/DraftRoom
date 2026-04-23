"use client";

import { useRef, type ElementType, type RefObject } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

interface TimelineContentProps {
  children: React.ReactNode;
  animationNum?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timelineRef?: RefObject<any>;
  customVariants?: Variants;
  className?: string;
  as?: ElementType;
}

export function TimelineContent({
  children,
  animationNum = 0,
  customVariants,
  className,
  as: _Tag,
}: TimelineContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "0px 0px -60px 0px" });

  const defaultVariants: Variants = {
    hidden: { opacity: 0, y: -20, filter: "blur(10px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.5, delay: animationNum * 0.05 },
    },
  };

  const variants = customVariants ?? defaultVariants;

  return (
    <motion.div
      ref={ref}
      variants={variants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      custom={animationNum}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
