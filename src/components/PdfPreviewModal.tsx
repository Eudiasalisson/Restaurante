import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReactNode, useRef } from 'react';

interface PdfPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfBlob: Blob | null;
  title?: string;
  fileName?: string;
  children?: ReactNode;
  size?: 'cupom' | 'a4';
}

export function PdfPreviewModal({ open, onOpenChange, pdfBlob, title = 'Cupom', fileName = 'cupom.pdf', children, size = 'cupom' }: PdfPreviewModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handlePrint = () => {
    if (!pdfBlob) return;

    const url = URL.createObjectURL(pdfBlob);
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');

    // Fallback para navegadores com bloqueio de popup
    if (!newWindow) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const maxW = size === 'a4' ? 'max-w-[700px]' : 'max-w-[360px]';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${maxW} max-h-[85vh] flex flex-col p-0 gap-0`}>
        <DialogHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <DialogTitle className="text-base">{title}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1">
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1">
              <Download className="h-4 w-4" /> Baixar PDF
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div ref={printRef} className={size === 'a4' ? 'p-6' : 'px-4 pb-4'}>
            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
