import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface EditarQtdItemProps {
  qtdAtual: number;
  onSave: (novaQtd: number) => Promise<void>;
  disabled?: boolean;
}

export function EditarQtdItem({ qtdAtual, onSave, disabled }: EditarQtdItemProps) {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState(String(qtdAtual));
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setValor(String(qtdAtual));
    setOpen(isOpen);
  };

  const handleSave = async () => {
    const novaQtd = parseInt(valor);
    if (isNaN(novaQtd) || novaQtd <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }
    setSaving(true);
    try {
      await onSave(novaQtd);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1 group cursor-pointer disabled:opacity-50 disabled:cursor-default"
          disabled={disabled}
        >
          <span>{qtdAtual}</span>
          {!disabled && <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3 space-y-3" align="center">
        <Label className="text-xs">Alterar quantidade</Label>
        <Input
          type="number"
          min={1}
          value={valor}
          onChange={e => setValor(e.target.value)}
          autoFocus
        />
        <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
