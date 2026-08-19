import { CircleHelp } from "lucide-react";

import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  description?: string;
  disabled?: boolean;
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = "any",
  description,
  disabled,
}: NumberFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {description && (
          <span className="group relative inline-flex">
            <button
              type="button"
              aria-label="項目の説明を表示"
              className="rounded-full text-slate-400 hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              <CircleHelp className="size-3.5" />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none invisible absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-md bg-slate-950 px-3 py-2 text-xs leading-5 text-white shadow-lg group-hover:visible group-focus-within:visible"
            >
              {description}
            </span>
          </span>
        )}
      </div>
      <Input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </div>
  );
}
