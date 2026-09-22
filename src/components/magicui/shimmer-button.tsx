"use client";

import { forwardRef, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Magic UI — Shimmer Button (adaptado ao design system). */
export interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
}

export const ShimmerButton = forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    { shimmerColor = "#ffffff", shimmerSize = "0.08em", shimmerDuration = "3s", borderRadius = "14px", background = "linear-gradient(135deg,#3d5afe,#2f4ae6)", className, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      style={
        {
          "--spread": "90deg",
          "--shimmer-color": shimmerColor,
          "--radius": borderRadius,
          "--speed": shimmerDuration,
          "--cut": shimmerSize,
          "--bg": background,
        } as CSSProperties
      }
      className={cn(
        "group relative z-0 flex cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap border border-white/10 px-6 py-3.5 font-semibold text-white [background:var(--bg)] [border-radius:var(--radius)]",
        "shadow-[0_10px_30px_-10px_rgba(61,90,254,0.8)] transition-transform duration-300 ease-in-out active:translate-y-px disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <div className="-z-30 blur-[2px] absolute inset-0 overflow-visible [container-type:size]">
        <div className="animate-shimmer-slide absolute inset-0 h-[100cqh] [aspect-ratio:1] [border-radius:0] [mask:none]">
          <div className="animate-spin-around absolute -inset-full w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
        </div>
      </div>
      {children}
      <div className="absolute inset-0 size-full rounded-[inherit] shadow-[inset_0_-8px_10px_#ffffff1f] transition-all duration-300 group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]" />
      <div className="absolute -z-20 [background:var(--bg)] [border-radius:var(--radius)] [inset:var(--cut)]" />
    </button>
  ),
);
ShimmerButton.displayName = "ShimmerButton";
