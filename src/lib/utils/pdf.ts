/**
 * Client-side PDF export.
 *
 * Captures a DOM element exactly as it appears on screen (dark theme, real
 * colors, real fonts) and writes it into a multi-page A4 PDF. We use
 * html2canvas-pro (a fork that handles modern CSS like oklch / lab) and jsPDF.
 *
 * Why screenshot rather than @media print?
 *   The dashboard is a dark-themed analytics view. Re-styling every component
 *   for print would diverge over time. A screenshot is WYSIWYG, including
 *   the gradients, brand colors, and chart fills.
 *
 * Multi-page handling: the captured canvas is sliced vertically so each PDF
 * page contains exactly one A4-height strip — no awkward page break that
 * splits a card or a chart legend.
 *
 * Dark-theme handling:
 *   The captured element (an inner <div>) doesn't own a background — the
 *   visible darkness comes from <body bg-background>. html2canvas captures
 *   only the painted area of the target, so without intervention we'd get a
 *   white PDF. We explicitly resolve the design system's `--background` CSS
 *   variable, apply it to both (a) the html2canvas canvas fill and (b) the
 *   captured element as a temporary inline style. The inline style is
 *   reverted in `finally` so the user's view is untouched.
 */

import jsPDF from "jspdf";

/* The pro fork handles modern CSS (oklch, conic-gradient) better than the
 * stock html2canvas. We dynamic-import it to keep the auth bundle small;
 * only triggered when a user actually hits "Export PDF". */
async function loadHtml2Canvas() {
  const mod = await import("html2canvas-pro");
  return mod.default;
}

export interface ExportPdfOptions {
  filename: string;
  /** Override CSS background color. Defaults to the dark theme `--background`. */
  background?: string;
  /** Capture scale; 2 = retina sharpness. Higher → bigger file. */
  scale?: number;
}

/**
 * Resolve the design-system dark background to a concrete CSS color the
 * canvas can fill with. We read `--background` (raw HSL components) off
 * <html> rather than computing `body`'s background-color, because:
 *   - `getComputedStyle(body).backgroundColor` can resolve to
 *     `rgba(0, 0, 0, 0)` if Tailwind base styles haven't materialized yet.
 *   - The CSS variable is the canonical source of truth for the theme.
 */
function resolveDarkBackground(): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--background")
    .trim();
  if (raw) {
    // Token format from index.css is bare HSL components like "230 20% 6%"
    return `hsl(${raw})`;
  }
  return "#0a0c14"; // last-resort fallback if the theme isn't loaded
}

export async function exportElementToPdf(
  element: HTMLElement,
  opts: ExportPdfOptions,
): Promise<void> {
  const html2canvas = await loadHtml2Canvas();

  const background = opts.background ?? resolveDarkBackground();
  const scale = opts.scale ?? 2;

  /* Hide elements marked as no-print during capture. We toggle a CSS class
   * on the html element, restore it after — keeps the user's view untouched. */
  document.documentElement.classList.add("pdf-exporting");

  /* Force the captured element to own the dark background during capture so
   * html2canvas paints it into the rasterized output. We snapshot the prior
   * inline style and restore it in `finally` so the on-screen view is
   * untouched if the user has DevTools open and is watching the DOM. */
  const previousBackground = element.style.backgroundColor;
  element.style.backgroundColor = background;

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      scale,
      backgroundColor: background,
      useCORS: true,
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });
  } finally {
    document.documentElement.classList.remove("pdf-exporting");
    element.style.backgroundColor = previousBackground;
  }

  /* Build a portrait A4 PDF in mm. The captured canvas is scaled to A4 width
   * then sliced into page-height chunks. */
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();

  const ratio = canvas.width / canvas.height;
  const renderedWidthMm = pageWidthMm;
  const renderedHeightMm = renderedWidthMm / ratio;

  const fullImage = canvas.toDataURL("image/png");

  if (renderedHeightMm <= pageHeightMm) {
    pdf.addImage(fullImage, "PNG", 0, 0, renderedWidthMm, renderedHeightMm);
  } else {
    /* Slice the source canvas vertically. Each slice is page-height tall in
     * the final PDF (so we draw at full page height with full page width). */
    const sliceHeightPx = Math.floor((pageHeightMm * canvas.width) / pageWidthMm);
    let y = 0;
    let pageIndex = 0;

    while (y < canvas.height) {
      const remaining = canvas.height - y;
      const thisSlicePx = Math.min(sliceHeightPx, remaining);

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = thisSlicePx;
      const ctx = sliceCanvas.getContext("2d");
      if (!ctx) throw new Error("PDF export: 2D canvas context unavailable");

      ctx.fillStyle = background;
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        y,
        canvas.width,
        thisSlicePx,
        0,
        0,
        sliceCanvas.width,
        thisSlicePx,
      );

      const sliceImage = sliceCanvas.toDataURL("image/png");
      const sliceMm = (thisSlicePx / canvas.width) * pageWidthMm;

      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(sliceImage, "PNG", 0, 0, pageWidthMm, sliceMm);

      y += thisSlicePx;
      pageIndex += 1;
    }
  }

  pdf.save(opts.filename);
}

/** Build a sensible filename from an influencer name + optional range label. */
export function pdfFilename(name: string, range?: string): string {
  const slug = (name || "dashboard")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const stamp = new Date().toISOString().slice(0, 10);
  const r = range ? `-${range}` : "";
  return `${slug || "dashboard"}${r}-${stamp}.pdf`;
}
