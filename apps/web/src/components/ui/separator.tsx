"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SeparatorProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

export function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: SeparatorProps) {
  return (
    <hr
      className={cn(
        "shrink-0 border-border",
        orientation === "horizontal" ? "w-full h-[1px]" : "h-full w-[1px]",
        className,
      )}
      aria-orientation={orientation}
      aria-hidden={decorative}
      {...props}
    />
  );
}
