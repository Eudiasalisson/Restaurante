import { Card, CardContent } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

export default function Pagamentos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif text-foreground flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-gold" /> Pagamentos
        </h1>
        <p className="text-sm text-muted-foreground">Histórico de pagamentos</p>
      </div>
      <Card className="glass">
        <CardContent className="py-12 text-center text-muted-foreground">
          Módulo de pagamentos em desenvolvimento.
        </CardContent>
      </Card>
    </div>
  );
}
