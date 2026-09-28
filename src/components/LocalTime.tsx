"use client";

/**
 * Server components render in the server's timezone. This formats timestamps in
 * the viewer's own timezone once the page reaches the browser.
 */
export function LocalTime({ iso, timeOnly = false }: { iso: string; timeOnly?: boolean }) {
  const date = new Date(iso);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {timeOnly ? date.toLocaleTimeString() : date.toLocaleString()}
    </time>
  );
}
