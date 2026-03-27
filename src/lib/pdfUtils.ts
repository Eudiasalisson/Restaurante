import jsPDF from 'jspdf';

/**
 * Draw a horizontal separator line in the PDF (replaces unicode ─ chars)
 */
export function pdfSep(doc: jsPDF, y: number, w: number, lh: number): number {
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(4, y, w - 4, y);
  return y + lh;
}

/**
 * Load an image URL and add it to the PDF as a centered logo.
 * Returns the new y position.
 */
export async function addLogoPdf(doc: jsPDF, logoUrl: string, y: number, w: number): Promise<number> {
  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    const logoSize = 12;
    doc.addImage(dataUrl, 'JPEG', (w - logoSize) / 2, y, logoSize, logoSize);
    return y + logoSize + 2;
  } catch {
    return y;
  }
}
