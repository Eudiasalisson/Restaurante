import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface EditarPrecoItemProps {
  precoAtual: number;
  onSave: (novoPreco: number) => Promise<void>;
  disabled?: boolean;
}

export function EditarPrecoItem({ precoAtual, onSave, disabled }: EditarPrecoItemProps) {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState(precoAtual.toFixed(2));
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setValor(precoAtual.toFixed(2));
    setOpen(isOpen);
  };

  const handleSave = async () => {
    const novoPreco = parseFloat(valor);
    if (isNaN(novoPreco) || novoPreco <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    setSaving(true);
    try {
      await onSave(novoPreco);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1 text-right group cursor-pointer disabled:opacity-50 disabled:cursor-default"
          disabled={disabled}
        >
          <span>R$ {precoAtual.toFixed(2)}</span>
          {!disabled && <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 space-y-3" align="end">
        <Label className="text-xs">Alterar preço unitário</Label>
        <CurrencyInput
          value={valor}
          onValueChange={setValor}
          autoFocus
        />
        <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
