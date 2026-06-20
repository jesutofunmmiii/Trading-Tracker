"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-md border border-navy-600 bg-navy-900 px-3 py-2 text-sm text-navy-50 placeholder:text-navy-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/50 focus-visible:border-gold-500/50 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
