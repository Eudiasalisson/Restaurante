import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Upload, Building2, Smartphone, Store, Lock, Wrench, Database, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  endereco: string | null;
  logo_url: string | null;
  taxa_servico_padrao: number | null;
  cardapio_status: string | null;
  whatsapp_pedidos: string | null;
  chave_pix: string | null;
  valor_minimo_pedido: number | null;
  tempo_medio_entrega: string | null;
  slogan: string | null;
  mensagem_conclusao: string | null;
  nfce_ambiente: string | null;
}

export default function Configuracoes() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [form, setForm] = useState({ nome: '', cnpj: '', telefone: '', endereco: '', taxa_servico_padrao: '10' });
  const [nfceAmbiente, setNfceAmbiente] = useState('homologacao');
  const [cardapioForm, setCardapioForm] = useState({
    cardapio_status: 'aberto', whatsapp_pedidos: '', chave_pix: '',
    valor_minimo_pedido: '0', tempo_medio_entrega: '40-60 min', slogan: '', mensagem_conclusao: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');

  const fetchEmpresa = async () => {
    const { data } = await supabase.from('empresas').select('*').limit(1).single();
    if (data) {
      const d = data as any;
      setEmpresa(d as Empresa);
      setForm({
        nome: d.nome, cnpj: d.cnpj || '', telefone: d.telefone || '',
        endereco: d.endereco || '', taxa_servico_padrao: String(d.taxa_servico_padrao ?? 10),
      });
      setCardapioForm({
        cardapio_status: d.cardapio_status || 'aberto',
        whatsapp_pedidos: d.whatsapp_pedidos || '',
        chave_pix: d.chave_pix || '',
        valor_minimo_pedido: String(d.valor_minimo_pedido ?? 0),
        tempo_medio_entrega: d.tempo_medio_entrega || '40-60 min',
        slogan: d.slogan || '',
        mensagem_conclusao: d.mensagem_conclusao || '',
      });
      setNfceAmbiente(d.nfce_ambiente || 'homologacao');
    }
  };

  const handleSaveNfce = async () => {
    if (!empresa) { toast.error('Cadastre a empresa primeiro'); return; }
    setSaving(true);
    const { error } = await supabase.from('empresas').update({ nfce_ambiente: nfceAmbiente }).eq('id', empresa.id);
    if (error) toast.error('Erro ao salvar');
    else { toast.success('Ambiente da NFC-e atualizado!'); fetchEmpresa(); }
    setSaving(false);
  };

  useEffect(() => { fetchEmpresa(); }, []);

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);

    let logoUrl = empresa?.logo_url || null;
    if (logoFile) {
      const ext = logoFile.name.split('.').pop();
      const path = `empresa/logo.${ext}`;
      const { error } = await supabase.storage.from('images').upload(path, logoFile, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from('images').getPublicUrl(path);
        logoUrl = data.publicUrl;
      }
    }

    const payload: any = {
      nome: form.nome.trim(), cnpj: form.cnpj || null, telefone: form.telefone || null,
      endereco: form.endereco || null, logo_url: logoUrl,
      taxa_servico_padrao: parseFloat(form.taxa_servico_padrao) || 10,
    };

    if (empresa) {
      const { error } = await supabase.from('empresas').update(payload).eq('id', empresa.id);
      if (error) toast.error('Erro ao salvar');
      else { toast.success('Configurações salvas!'); fetchEmpresa(); }
    } else {
      const { error } = await supabase.from('empresas').insert(payload);
      if (error) toast.error('Erro ao criar');
      else { toast.success('Empresa cadastrada!'); fetchEmpresa(); }
    }
    setSaving(false);
  };

  const handleSaveCardapio = async () => {
    if (!empresa) { toast.error('Cadastre a empresa primeiro'); return; }
    setSaving(true);
    const payload: any = {
      cardapio_status: cardapioForm.cardapio_status,
      whatsapp_pedidos: cardapioForm.whatsapp_pedidos || null,
      chave_pix: cardapioForm.chave_pix || null,
      valor_minimo_pedido: parseFloat(cardapioForm.valor_minimo_pedido) || 0,
      tempo_medio_entrega: cardapioForm.tempo_medio_entrega || null,
      slogan: cardapioForm.slogan || null,
      mensagem_conclusao: cardapioForm.mensagem_conclusao || null,
    };
    const { error } = await supabase.from('empresas').update(payload).eq('id', empresa.id);
    if (error) toast.error('Erro ao salvar');
    else { toast.success('Cardápio digital atualizado!'); fetchEmpresa(); }
    setSaving(false);
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setSaving(true);
    const { error } = await updatePassword(newPassword);
    if (error) {
      toast.error('Erro ao atualizar senha: ' + error.message);
    } else {
      toast.success('Senha atualizada com sucesso!');
      setNewPassword('');
    }
    setSaving(false);
  };

  const handleMaintenance = async () => {
    if (!confirm('Esta ação vinculará todas as comandas e entregas fechadas sem cliente ao cadastro "Consumidor Final". Deseja continuar?')) return;
    
    setSaving(true);
    try {
      let consumidorId = '';
      const { data: existing } = await supabase.from('clientes').select('id').ilike('nome', 'Consumidor Final').maybeSingle();
      
      if (existing) {
        consumidorId = existing.id;
      } else {
        const { data: created } = await supabase.from('clientes').insert({ nome: 'Consumidor Final' }).select('id').single();
        if (created) consumidorId = created.id;
      }

      if (!consumidorId) throw new Error('Erro ao identificar Consumidor Final');

      const { data: comRes } = await supabase
        .from('comandas')
        .update({ cliente_id: consumidorId })
        .eq('status', 'fechada')
        .is('cliente_id', null)
        .select('id');

      const { data: entRes } = await supabase
        .from('entregas')
        .update({ cliente_id: consumidorId })
        .eq('status', 'entregue')
        .is('cliente_id', null)
        .select('id');

      toast.success('Manutenção concluída!');
    } catch (error) {
      console.error(error);
      toast.error('Erro na manutenção');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-muted-foreground" /> Configurações
        </h1>
        <p className="text-sm text-muted-foreground">Dados da empresa e cardápio digital</p>
      </div>

      <Tabs defaultValue="empresa">
        <TabsList>
          <TabsTrigger value="empresa" className="gap-2"><Building2 className="h-4 w-4" /> Empresa</TabsTrigger>
          <TabsTrigger value="cardapio" className="gap-2"><Smartphone className="h-4 w-4" /> Cardápio Digital</TabsTrigger>
          <TabsTrigger value="nfce" className="gap-2"><FileText className="h-4 w-4" /> NFC-e</TabsTrigger>
          <TabsTrigger value="seguranca" className="gap-2"><Lock className="h-4 w-4" /> Segurança</TabsTrigger>
          <TabsTrigger value="manutencao" className="gap-2"><Wrench className="h-4 w-4" /> Manutenção</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa">
          <Card className="glass">
            <CardHeader><CardTitle className="font-serif flex items-center gap-2"><Building2 className="h-5 w-5" /> Empresa</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                {empresa?.logo_url ? (
                  <img src={empresa.logo_url} alt="Logo" className="h-20 w-20 rounded-lg object-cover border border-border" />
                ) : (
                  <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center border border-border">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    {logoFile ? logoFile.name : 'Upload logo'}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nome da empresa *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
                <div className="space-y-2"><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Taxa de serviço padrão (%)</Label><Input type="number" value={form.taxa_servico_padrao} onChange={e => setForm(f => ({ ...f, taxa_servico_padrao: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Endereço</Label><Input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} /></div>
              <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cardapio">
          <Card className="glass">
            <CardHeader><CardTitle className="font-serif flex items-center gap-2"><Smartphone className="h-5 w-5" /> Cardápio Digital</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border">
                <Store className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <Label>Status da loja</Label>
                  <p className="text-xs text-muted-foreground">Define se o cardápio aceita pedidos</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{cardapioForm.cardapio_status === 'aberto' ? 'Aberto' : 'Fechado'}</span>
                  <Switch checked={cardapioForm.cardapio_status === 'aberto'} onCheckedChange={v => setCardapioForm(f => ({ ...f, cardapio_status: v ? 'aberto' : 'fechado' }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>WhatsApp para pedidos</Label><Input placeholder="5511999999999" value={cardapioForm.whatsapp_pedidos} onChange={e => setCardapioForm(f => ({ ...f, whatsapp_pedidos: e.target.value }))} /><p className="text-xs text-muted-foreground">Formato: código do país + DDD + número</p></div>
                <div className="space-y-2"><Label>Chave Pix</Label><Input placeholder="email@exemplo.com" value={cardapioForm.chave_pix} onChange={e => setCardapioForm(f => ({ ...f, chave_pix: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Valor mínimo do pedido (R$)</Label><Input type="number" value={cardapioForm.valor_minimo_pedido} onChange={e => setCardapioForm(f => ({ ...f, valor_minimo_pedido: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Tempo médio de entrega</Label><Input placeholder="40-60 min" value={cardapioForm.tempo_medio_entrega} onChange={e => setCardapioForm(f => ({ ...f, tempo_medio_entrega: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Slogan / Mensagem de boas-vindas</Label><Input placeholder="A melhor culinária japonesa da cidade" value={cardapioForm.slogan} onChange={e => setCardapioForm(f => ({ ...f, slogan: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Mensagem de conclusão do pedido</Label><Textarea placeholder="Obrigado pelo pedido! Seu pedido está sendo preparado..." value={cardapioForm.mensagem_conclusao} onChange={e => setCardapioForm(f => ({ ...f, mensagem_conclusao: e.target.value }))} /></div>
              <Button onClick={handleSaveCardapio} disabled={saving} className="w-full md:w-auto">
                {saving ? 'Salvando...' : 'Salvar Cardápio Digital'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="nfce">
          <Card className="glass">
            <CardHeader><CardTitle className="font-serif flex items-center gap-2"><FileText className="h-5 w-5" /> Nota Fiscal (NFC-e)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A emissão de NFC-e é feita via integração com a <strong>Notaas</strong>. O cadastro fiscal da empresa (CNPJ, certificado digital, CSC da Sefaz-MG) é configurado diretamente no painel da Notaas — aqui você só controla se o sistema está operando em modo de teste ou em produção.
              </p>
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border">
                <div className="flex-1">
                  <Label>Ambiente ativo</Label>
                  <p className="text-xs text-muted-foreground">Deve corresponder à chave de API configurada nos secrets do Supabase (NOTAAS_API_KEY)</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{nfceAmbiente === 'producao' ? 'Produção' : 'Homologação'}</span>
                  <Switch checked={nfceAmbiente === 'producao'} onCheckedChange={v => setNfceAmbiente(v ? 'producao' : 'homologacao')} />
                </div>
              </div>
              {nfceAmbiente === 'homologacao' ? (
                <div className="p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p><strong>Modo teste.</strong> As NFC-e emitidas não têm valor fiscal. Use este modo até validar todo o fluxo antes de ir para produção.</p>
                </div>
              ) : (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p><strong>Modo produção.</strong> As NFC-e emitidas a partir de agora têm valor fiscal real e são enviadas à Sefaz-MG.</p>
                </div>
              )}
              <Button onClick={handleSaveNfce} disabled={saving} className="w-full md:w-auto">
                {saving ? 'Salvando...' : 'Salvar Ambiente'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="seguranca">
          <Card className="glass">
            <CardHeader><CardTitle className="font-serif flex items-center gap-2"><Lock className="h-5 w-5" /> Segurança da Conta</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label>Nova Senha</Label>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                  />
                  <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
                </div>
                <Button onClick={handleUpdatePassword} disabled={saving}>
                  {saving ? 'Atualizando...' : 'Atualizar Minha Senha'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="manutencao">
          <Card className="glass">
            <CardHeader><CardTitle className="font-serif flex items-center gap-2"><Database className="h-5 w-5 text-accent" /> Manutenção do Banco</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20 space-y-3">
                <h3 className="font-medium text-foreground">Vincular Vendas Órfãs</h3>
                <p className="text-sm text-muted-foreground">
                  Esta ferramenta busca todas as vendas (comandas e entregas) que foram finalizadas sem um cliente informado e as associa ao cliente "Consumidor Final". 
                  Isso garante que os relatórios por cliente fiquem consistentes com o faturamento total.
                </p>
                <Button onClick={handleMaintenance} disabled={saving} variant="outline" className="border-accent/40 hover:bg-accent/10">
                  <Database className="h-4 w-4 mr-2" /> Corrigir Vendas Sem Cliente
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
