import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/shared/lib/utils";

export function Alert({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="alert"
      className={cn("flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950", className)}
      {...props}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
