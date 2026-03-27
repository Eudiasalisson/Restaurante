import * as React from "react";
import { cn } from "@/lib/utils";

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * Input de telefone com máscara brasileira: (XX) XXXX-XXXX ou (XX) XXXXX-XXXX
 * Suporta 8 ou 9 dígitos após o DDD.
 * O valor retornado por onValueChange é apenas os dígitos.
 */
const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value, onValueChange, placeholder, ...props }, ref) => {
    const formatPhone = (digits: string): string => {
      const d = digits.replace(/\D/g, '').slice(0, 11);
      if (d.length === 0) return '';
      if (d.length <= 2) return `(${d}`;
      if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    };

    const [display, setDisplay] = React.useState(() => formatPhone(value || ''));

    React.useEffect(() => {
      setDisplay(formatPhone(value || ''));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
      setDisplay(formatPhone(raw));
      onValueChange(raw);
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
        placeholder={placeholder ?? "(00) 00000-0000"}
        value={display}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
