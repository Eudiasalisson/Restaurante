import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useEmpresa } from '@/hooks/useEmpresa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';

export default function Login() {
  const { signIn } = useAuth();
  const { empresa } = useEmpresa();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error('E-mail ou senha inválidos');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-[400px] glass glow-red">
          <CardHeader className="text-center space-y-3 pb-2">
            {empresa?.logo_url ? (
              <img src={empresa.logo_url} alt="Logo" className="h-16 w-16 rounded-lg object-cover mx-auto" />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center mx-auto border border-border">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <h2 className="text-xl font-serif text-foreground">{empresa?.nome || 'Sistema de Gestão'}</h2>
            <p className="text-sm text-muted-foreground">Acesso ao sistema</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Carregando...' : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
