"use client";

import * as Popover from "@radix-ui/react-popover";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import "react-day-picker/style.css";

type Props = {
  value: Date | null;
  onChange: (next: Date | null) => void;
  placeholder?: string;
  id?: string;
  className?: string;
};

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date & time",
  id,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState<string>(value ? format(value, "HH:mm") : "12:00");

  function applyDate(date: Date | undefined) {
    if (!date) return;
    const [h, m] = time.split(":").map(Number);
    const next = new Date(date);
    next.setHours(h ?? 12, m ?? 0, 0, 0);
    onChange(next);
  }

  function applyTime(next: string) {
    setTime(next);
    if (value) {
      const [h, m] = next.split(":").map(Number);
      const merged = new Date(value);
      merged.setHours(h ?? 0, m ?? 0, 0, 0);
      onChange(merged);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className="relative">
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            className={`w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-left text-sm flex items-center gap-2 hover:border-zinc-400 dark:hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${value ? "pr-9" : ""} ${className ?? ""}`}
          >
            <CalendarIcon className="size-4 text-zinc-500 shrink-0" />
            <span className={value ? "" : "text-zinc-400"}>
              {value ? format(value, "MMM d, yyyy 'at' HH:mm") : placeholder}
            </span>
          </button>
        </Popover.Trigger>
        {value && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => onChange(null)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="size-3.5 text-zinc-500" />
          </button>
        )}
      </div>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg p-3"
        >
          <DayPicker
            mode="single"
            selected={value ?? undefined}
            onSelect={applyDate}
            disabled={{ before: new Date() }}
            classNames={{
              today: "font-semibold text-emerald-600",
              selected: "!bg-emerald-600 !text-white !rounded-md",
              chevron: "fill-zinc-700 dark:fill-zinc-300",
            }}
          />
          <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
            <label htmlFor="dtp-time" className="text-xs text-zinc-500">
              Time
            </label>
            <input
              id="dtp-time"
              type="time"
              value={time}
              onChange={(e) => applyTime(e.target.value)}
              className="flex-1 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-2.5 py-1 rounded text-xs bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Done
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
