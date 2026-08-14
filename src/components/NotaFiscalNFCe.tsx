import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { baixarDanfe, NotaFiscalStatus, NOTA_FISCAL_STATUS_CONFIG } from '@/lib/nfce';
import { FileText, Loader2, ExternalLink, RefreshCw, XCircle, AlertTriangle, UserCheck } from 'lucide-react';

interface NotaFiscal {
  id: string;
  status: NotaFiscalStatus;
  ambiente: string;
  chave_acesso: string | null;
  pdf_url: string | null;
  erro_mensagem: string | null;
  xmotivo: string | null;
}

interface NotaFiscalNFCeProps {
  comandaId?: string;
  entregaId?: string;
  podeEmitir: boolean;
  clienteId?: string | null;
  clienteNome?: string | null;
  onClienteAtualizado?: () => void;
}

export function NotaFiscalNFCe({ comandaId, entregaId, podeEmitir, clienteId, clienteNome, onClienteAtualizado }: NotaFiscalNFCeProps) {
  const [notaFiscal, setNotaFiscal] = useState<NotaFiscal | null>(null);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [emitindo, setEmitindo] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [baixandoDanfe, setBaixandoDanfe] = useState(false);
  const [identModal, setIdentModal] = useState(false);
  const [identPedeNome, setIdentPedeNome] = useState(false);
  const [identNome, setIdentNome] = useState('');
  const [identCpf, setIdentCpf] = useState('');
  const [identificando, setIdentificando] = useState(false);
  const pollRef = useRef<number | null>(null);
  const pollCountRef = useRef(0);
  const lastIdentificarRef = useRef(false);

  const clienteEhGenerico = !clienteId || (clienteNome || '').trim().toLowerCase() === 'consumidor final';

  const fetchNotaFiscal = useCallback(async () => {
    let query = supabase.from('notas_fiscais').select('*').order('created_at', { ascending: false }).limit(1);
    query = comandaId ? query.eq('comanda_id', comandaId) : query.eq('entrega_id', entregaId!);
    const { data } = await query.maybeSingle();
    setNotaFiscal(data as NotaFiscal | null);
    setLoadingInicial(false);
    return data as NotaFiscal | null;
  }, [comandaId, entregaId]);

  useEffect(() => { fetchNotaFiscal(); }, [fetchNotaFiscal]);

  const consultarStatus = useCallback(async (notaFiscalId: string, silent = false) => {
    if (!silent) setConsultando(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('consultar-nfce', {
        body: { nota_fiscal_id: notaFiscalId },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      if (error) throw error;
      if (data?.notaFiscal) setNotaFiscal(data.notaFiscal);
      return data?.notaFiscal as NotaFiscal | undefined;
    } catch {
      if (!silent) toast.error('Erro ao consultar status da NFC-e');
      return undefined;
    } finally {
      if (!silent) setConsultando(false);
    }
  }, []);

  // Poll automático enquanto a nota está em processamento (webhook cobre o caso comum,
  // isso é só um fallback para não deixar o operador sem retorno).
  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    pollCountRef.current = 0;
    if (!notaFiscal || (notaFiscal.status !== 'queued' && notaFiscal.status !== 'processing')) return;

    pollRef.current = window.setInterval(async () => {
      pollCountRef.current += 1;
      const atualizado = await consultarStatus(notaFiscal.id, true);
      if (!atualizado || (atualizado.status !== 'queued' && atualizado.status !== 'processing') || pollCountRef.current >= 12) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    }, 5000);

    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [notaFiscal, consultarStatus]);

  const handleEmitir = async (identificar: boolean) => {
    lastIdentificarRef.current = identificar;
    setEmitindo(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('emitir-nfce', {
        body: {
          ...(comandaId ? { comanda_id: comandaId } : { entrega_id: entregaId }),
          identificar_cliente: identificar,
        },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setNotaFiscal(data.notaFiscal);
      toast.success('NFC-e enviada para emissão!');
    } catch {
      toast.error('Erro ao emitir NFC-e');
    } finally {
      setEmitindo(false);
    }
  };

  // Botão "Emitir NFC-e identificado": garante que o cliente vinculado tenha CPF
  // antes de emitir. Se a venda ainda estiver no cliente genérico "Consumidor Final"
  // (ou sem cliente nenhum), pede nome+CPF e vincula um cliente real à venda —
  // nunca grava CPF no cadastro compartilhado do Consumidor Final.
  const abrirIdentificado = async () => {
    if (clienteEhGenerico) {
      setIdentPedeNome(true);
      setIdentNome('');
      setIdentCpf('');
      setIdentModal(true);
      return;
    }
    const { data: cliente } = await supabase.from('clientes').select('cpf').eq('id', clienteId!).single();
    if (cliente?.cpf) {
      handleEmitir(true);
    } else {
      setIdentPedeNome(false);
      setIdentNome('');
      setIdentCpf('');
      setIdentModal(true);
    }
  };

  const handleConfirmarIdentificacao = async () => {
    const cpfDigits = identCpf.replace(/\D/g, '');
    if (cpfDigits.length !== 11) { toast.error('Informe um CPF válido (11 dígitos)'); return; }
    if (identPedeNome && !identNome.trim()) { toast.error('Informe o nome do cliente'); return; }

    setIdentificando(true);
    try {
      if (identPedeNome) {
        const { data: existente } = await supabase.from('clientes').select('id').eq('cpf', cpfDigits).maybeSingle();
        let novoClienteId = existente?.id;
        if (!novoClienteId) {
          const { data: criado, error } = await supabase.from('clientes').insert({ nome: identNome.trim(), cpf: cpfDigits }).select('id').single();
          if (error) throw error;
          novoClienteId = criado.id;
        }
        const refTable = comandaId ? 'comandas' : 'entregas';
        const refId = comandaId || entregaId!;
        const { error: updError } = await supabase.from(refTable).update({ cliente_id: novoClienteId }).eq('id', refId);
        if (updError) throw updError;
      } else {
        const { error } = await supabase.from('clientes').update({ cpf: cpfDigits }).eq('id', clienteId!);
        if (error) throw error;
      }
      onClienteAtualizado?.();
      setIdentModal(false);
      await handleEmitir(true);
    } catch {
      toast.error('Erro ao identificar cliente');
    } finally {
      setIdentificando(false);
    }
  };

  const handleVerDanfe = async () => {
    if (!notaFiscal) return;
    setBaixandoDanfe(true);
    try {
      await baixarDanfe(notaFiscal.id);
    } catch (e) {
      toast.error((e as Error).message || 'Erro ao abrir o DANFE');
    } finally {
      setBaixandoDanfe(false);
    }
  };

  const handleCancelar = async () => {
    if (!notaFiscal) return;
    if (motivoCancelamento.trim().length < 15) {
      toast.error('Informe um motivo com pelo menos 15 caracteres');
      return;
    }
    setCancelando(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('cancelar-nfce', {
        body: { nota_fiscal_id: notaFiscal.id, motivo: motivoCancelamento.trim() },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setNotaFiscal(data.notaFiscal);
      toast.success('NFC-e cancelada');
      setCancelModal(false);
      setMotivoCancelamento('');
    } catch {
      toast.error('Erro ao cancelar NFC-e');
    } finally {
      setCancelando(false);
    }
  };

  if (loadingInicial) return null;

  return (
    <>
      <Separator />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Nota Fiscal (NFC-e)
          </p>
          {notaFiscal && (
            <Badge className={NOTA_FISCAL_STATUS_CONFIG[notaFiscal.status].className}>{NOTA_FISCAL_STATUS_CONFIG[notaFiscal.status].label}</Badge>
          )}
        </div>

        {notaFiscal?.ambiente === 'homologacao' && (
          <p className="text-[10px] text-warning flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Modo teste (homologação) — sem valor fiscal
          </p>
        )}

        {!notaFiscal && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleEmitir(false)}
              disabled={!podeEmitir || emitindo || identificando}
              title={!podeEmitir ? 'Só é possível emitir após o pagamento total' : undefined}
            >
              {emitindo && !lastIdentificarRef.current ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
              Emitir NFC-e
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={abrirIdentificado}
              disabled={!podeEmitir || emitindo || identificando}
              title={!podeEmitir ? 'Só é possível emitir após o pagamento total' : undefined}
            >
              {(emitindo && lastIdentificarRef.current) || identificando ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5 mr-1.5" />}
              Emitir identificado
            </Button>
          </div>
        )}

        {(notaFiscal?.status === 'queued' || notaFiscal?.status === 'processing') && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => consultarStatus(notaFiscal.id)} disabled={consultando}>
            {consultando ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Verificar status
          </Button>
        )}

        {notaFiscal?.status === 'issued' && (
          <div className="space-y-1.5">
            {notaFiscal.chave_acesso && (
              <p className="text-[10px] text-muted-foreground font-mono break-all">{notaFiscal.chave_acesso}</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleVerDanfe} disabled={baixandoDanfe}>
                {baixandoDanfe ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />}
                Ver DANFE
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => setCancelModal(true)}>
                <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancelar
              </Button>
            </div>
          </div>
        )}

        {notaFiscal?.status === 'error' && (
          <div className="space-y-1.5">
            <p className="text-xs text-destructive">{notaFiscal.erro_mensagem || notaFiscal.xmotivo || 'Erro ao emitir a NFC-e.'}</p>
            <Button variant="outline" size="sm" className="w-full" onClick={() => handleEmitir(lastIdentificarRef.current)} disabled={emitindo}>
              {emitindo ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Tentar novamente
            </Button>
          </div>
        )}
      </div>

      <Dialog open={cancelModal} onOpenChange={setCancelModal}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-destructive">Cancelar NFC-e</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>O prazo para cancelamento de NFC-e varia por estado. Se a Sefaz recusar, o cancelamento falhará.</p>
            </div>
            <div className="space-y-2">
              <Label>Motivo do cancelamento * (mín. 15 caracteres)</Label>
              <Textarea value={motivoCancelamento} onChange={e => setMotivoCancelamento(e.target.value)} placeholder="Ex: Venda cancelada a pedido do cliente após pagamento" />
            </div>
            <Button variant="destructive" className="w-full" onClick={handleCancelar} disabled={cancelando}>
              {cancelando ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={identModal} onOpenChange={setIdentModal}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Identificar cliente na NFC-e</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {identPedeNome && (
              <div className="space-y-2">
                <Label>Nome do cliente *</Label>
                <Input value={identNome} onChange={e => setIdentNome(e.target.value)} placeholder="Nome completo" />
              </div>
            )}
            <div className="space-y-2">
              <Label>CPF *</Label>
              <Input value={identCpf} onChange={e => setIdentCpf(e.target.value)} placeholder="000.000.000-00" />
              {identPedeNome && (
                <p className="text-xs text-muted-foreground">Se já existir um cliente com esse CPF, a venda será vinculada a ele em vez de criar um novo cadastro.</p>
              )}
            </div>
            <Button className="w-full" onClick={handleConfirmarIdentificacao} disabled={identificando}>
              {identificando ? 'Identificando...' : 'Confirmar e Emitir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
