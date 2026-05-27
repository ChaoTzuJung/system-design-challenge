"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

type Props = {
  value: string;
  size?: number;
  className?: string;
};

export function QRPreview({ value, size = 192, className }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value) {
      setDataUrl(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const url = await QRCode.toDataURL(value, {
          margin: 1,
          width: size,
          color: { dark: "#0a0a0a", light: "#ffffff" },
        });
        setDataUrl(url);
      } catch {
        setDataUrl(null);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, size]);

  return (
    <div
      className={`grid place-items-center bg-white rounded-lg border border-zinc-200 dark:border-zinc-800 ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="QR preview" width={size} height={size} />
      ) : (
        <span className="text-xs text-zinc-400">Type a URL…</span>
      )}
    </div>
  );
}
