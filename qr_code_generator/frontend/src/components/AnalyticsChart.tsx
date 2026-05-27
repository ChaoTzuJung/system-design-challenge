"use client";

import { format } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; count: number };

export function AnalyticsChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No scans yet. Share the short URL to start collecting.
      </p>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: format(new Date(d.date), "MMM d"),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
          <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: "currentColor", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: "var(--background)",
              border: "1px solid rgb(228 228 231)",
              borderRadius: 8,
              fontSize: 13,
            }}
          />
          <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
