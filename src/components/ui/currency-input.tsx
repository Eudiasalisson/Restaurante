import * as React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string | number;
  onValueChange: (value: string) => void;
}

/**
 * Input monetário com formatação automática usando vírgula como separador decimal.
 * Funciona no estilo ATM: os dígitos vão preenchendo da direita para a esquerda.
 * O valor retornado por onValueChange é sempre string com ponto decimal (ex: "12.50").
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onValueChange, placeholder, ...props }, ref) => {
    const formatDisplay = (val: string | number): string => {
      const num = typeof val === 'number' ? val : parseFloat(val);
      if (isNaN(num) || (!num && num !== 0)) return '';
      if (num === 0 && val === '') return '';
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const [display, setDisplay] = React.useState(() => formatDisplay(value));

    React.useEffect(() => {
      // Sync display when value changes externally
      const numVal = typeof value === 'number' ? value : parseFloat(value as string);
      if (!isNaN(numVal)) {
        setDisplay(numVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      } else if (value === '' || value === undefined || value === null) {
        setDisplay('');
      }
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow: backspace, delete, tab, escape, enter, arrows
      const allowed = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (allowed.includes(e.key)) return;
      // Allow digits only
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, '');
      if (raw === '' || raw === '0' || raw === '00') {
        setDisplay('');
        onValueChange('');
        return;
      }
      const cents = parseInt(raw, 10);
      const reais = cents / 100;
      const formatted = reais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      setDisplay(formatted);
      onValueChange(reais.toFixed(2));
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (!display) {
        setDisplay('0,00');
        onValueChange('0.00');
      }
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (display === '0,00' || display === '') {
        setDisplay('');
        onValueChange('');
      }
      props.onBlur?.(e);
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        placeholder={placeholder ?? "0,00"}
        value={display}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
