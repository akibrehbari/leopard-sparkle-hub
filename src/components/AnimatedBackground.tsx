"use client";

import { useTheme } from "./ThemeProvider";

export function AnimatedBackground() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const blob = isDark
    ? { a: "hsl(0 0% 16%)", b: "hsl(0 0% 12%)", c: "hsl(0 0% 10%)" }
    : { a: "hsl(0 0% 82%)", b: "hsl(0 0% 86%)", c: "hsl(0 0% 88%)" };

  return (
    <>
      <div className="bg-blob bg-blob-1" style={{ width: 700, height: 700, top: "-180px",  left: "-160px",  background: blob.a, opacity: isDark ? 1 : 0.8 }} />
      <div className="bg-blob bg-blob-2" style={{ width: 600, height: 600, bottom: "-120px", right: "-140px", background: blob.b, opacity: isDark ? 0.9 : 0.7 }} />
      <div className="bg-blob bg-blob-3" style={{ width: 500, height: 500, top: "38%",      left: "42%",     background: blob.c, opacity: isDark ? 0.8 : 0.6 }} />
    </>
  );
}
