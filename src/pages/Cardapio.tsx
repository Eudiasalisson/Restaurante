import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, Plus, Minus, X, Trash2, ChevronRight, MapPin, CreditCard, Check, Clock, DollarSign, Store, Copy, MessageCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import heroImg from '@/assets/cardapio-hero.jpg';
import placeholderImg from '@/assets/produto-placeholder.jpg';

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco_venda: number;
  preco_promocional: number | null;
  promocao_ativa: boolean;
  imagem_url: string | null;
  ativo: boolean;
  categoria_id: string | null;
  mais_pedido: boolean;
  novidade: boolean;
}

interface Categoria {
  id: string;
  nome: string;
}

interface CartItem {
  produto: Produto;
  quantidade: number;
  observacao: string;
}

interface EmpresaConfig {
  nome: string;
  logo_url: string | null;
  telefone: string | null;
  cardapio_status: string;
  whatsapp_pedidos: string | null;
  chave_pix: string | null;
  valor_minimo_pedido: number;
  tempo_medio_entrega: string;
  slogan: string | null;
  mensagem_conclusao: string | null;
}

const CART_KEY = 'cardapio_cart';

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Cardapio() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [modalQty, setModalQty] = useState(1);
  const [modalObs, setModalObs] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [checkoutData, setCheckoutData] = useState({
    nome: '', telefone: '', tipo_entrega: 'entrega',
    cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', referencia: '',
    forma_pagamento: '', troco_para: '',
  });
  const [cepLoading, setCepLoading] = useState(false);
  const [pixCopiado, setPixCopiado] = useState(false);
  const catBarRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: prods }, { data: cats }, { data: emp }] = await Promise.all([
        supabase.from('produtos').select('id, nome, descricao, preco_venda, preco_promocional, promocao_ativa, imagem_url, ativo, categoria_id, mais_pedido, novidade').eq('exibir_cardapio', true).order('nome'),
        supabase.from('categorias').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('empresas').select('nome, logo_url, telefone, cardapio_status, whatsapp_pedidos, chave_pix, valor_minimo_pedido, tempo_medio_entrega, slogan, mensagem_conclusao').limit(1).single(),
      ]);
      if (prods) setProdutos(prods as any[]);
      if (cats) setCategorias((cats as Categoria[]).filter(c => !c.nome.toLowerCase().includes('funcionário') && !c.nome.toLowerCase().includes('funcionario')));
      if (emp) setEmpresa(emp as any);
    };
    fetchData();
  }, []);

  useEffect(() => { saveCart(cart); }, [cart]);

  const cartTotal = cart.reduce((s, i) => s + (i.produto.promocao_ativa && i.produto.preco_promocional ? i.produto.preco_promocional : i.produto.preco_venda) * i.quantidade, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantidade, 0);

  const filteredProdutos = useMemo(() => {
    if (!search.trim()) return produtos;
    return produtos.filter(p => p.nome.toLowerCase().includes(search.toLowerCase()));
  }, [produtos, search]);

  const groupedByCategory = useMemo(() => {
    const groups: { cat: Categoria; items: Produto[] }[] = [];
    const catMap = new Map<string, Produto[]>();
    const noCat: Produto[] = [];
    filteredProdutos.forEach(p => {
      if (p.categoria_id) {
        if (!catMap.has(p.categoria_id)) catMap.set(p.categoria_id, []);
        catMap.get(p.categoria_id)!.push(p);
      } else noCat.push(p);
    });
    categorias.forEach(c => {
      const items = catMap.get(c.id);
      if (items && items.length > 0) groups.push({ cat: c, items });
    });
    if (noCat.length > 0) groups.push({ cat: { id: 'outros', nome: 'Outros' }, items: noCat });
    return groups;
  }, [filteredProdutos, categorias]);

  const scrollToCategory = (catId: string) => {
    setActiveCat(catId);
    const el = sectionRefs.current[catId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getPrice = (p: Produto) => p.promocao_ativa && p.preco_promocional ? p.preco_promocional : p.preco_venda;

  const addToCart = () => {
    if (!selectedProduto || !selectedProduto.ativo) return;
    setCart(prev => {
      const existing = prev.findIndex(i => i.produto.id === selectedProduto.id && i.observacao === modalObs);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantidade: updated[existing].quantidade + modalQty };
        return updated;
      }
      return [...prev, { produto: selectedProduto, quantidade: modalQty, observacao: modalObs }];
    });
    setSelectedProduto(null);
    setModalQty(1);
    setModalObs('');
  };

  const removeFromCart = (index: number) => setCart(prev => prev.filter((_, i) => i !== index));
  const updateCartQty = (index: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const newQty = item.quantidade + delta;
      return newQty < 1 ? item : { ...item, quantidade: newQty };
    }));
  };

  const fetchCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setCheckoutData(d => ({ ...d, rua: data.logradouro || '', bairro: data.bairro || '', cidade: `${data.localidade}/${data.uf}` }));
      }
    } catch {} finally { setCepLoading(false); }
  };

  const sendWhatsApp = () => {
    const d = checkoutData;
    const items = cart.map(i => {
      const price = getPrice(i.produto) * i.quantidade;
      let line = `- ${i.quantidade}x ${i.produto.nome} — ${formatCurrency(price)}`;
      if (i.observacao) line += `\n  _Obs: ${i.observacao}_`;
      return line;
    }).join('\n');

    let msg = `*NOVO PEDIDO* - ${empresa?.nome || 'Restaurante'}\n\n`;
    msg += `*Cliente:* ${d.nome}\n*Telefone:* ${d.telefone}\n\n`;
    msg += `*Itens do Pedido:*\n${items}\n\n`;
    msg += `*Total: ${formatCurrency(cartTotal)}*\n\n`;
    msg += `*Tipo:* ${d.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada no local'}\n`;
    if (d.tipo_entrega === 'entrega') {
      msg += `*Endereco:* ${d.rua}, ${d.numero}${d.complemento ? ` - ${d.complemento}` : ''}\nBairro ${d.bairro} - ${d.cidade}\nCEP: ${d.cep}\n`;
      if (d.referencia) msg += `Referencia: ${d.referencia}\n`;
    }
    msg += `\n*Pagamento:* ${d.forma_pagamento}\n`;
    if (d.forma_pagamento === 'Dinheiro' && d.troco_para) msg += `*Troco para:* R$ ${d.troco_para}\n`;
    msg += `\nPedido realizado via cardapio digital.`;

    const phone = (empresa?.whatsapp_pedidos || '').replace(/\D/g, '');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    setCart([]);
    setCheckoutOpen(false);
    setCheckoutStep(1);
    setCheckoutData({ nome: '', telefone: '', tipo_entrega: 'entrega', cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', referencia: '', forma_pagamento: '', troco_para: '' });
  };

  const canProceedStep1 = checkoutData.nome.trim() && checkoutData.telefone.trim();
  const canProceedStep2 = checkoutData.tipo_entrega === 'retirada' || (checkoutData.rua.trim() && checkoutData.numero.trim() && checkoutData.bairro.trim() && checkoutData.cidade.trim());
  const canProceedStep3 = !!checkoutData.forma_pagamento;

  const isOpen = empresa?.cardapio_status === 'aberto';

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a', color: '#f5f5f5' }}>
      {/* Header fixo */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b" style={{ background: 'rgba(10,10,10,0.9)', borderColor: '#222' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            {empresa?.logo_url && <img src={empresa.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" />}
            <span className="font-bold text-lg" style={{ color: '#e63946' }}>{empresa?.nome || 'Cardápio'}</span>
          </div>
          <button onClick={() => setDrawerOpen(true)} className="relative p-2 rounded-lg transition-colors" style={{ background: '#1a1a1a' }}>
            <ShoppingCart className="h-5 w-5" style={{ color: '#e63946' }} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs font-bold flex items-center justify-center text-white" style={{ background: '#e63946' }}>
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-14 overflow-hidden" style={{ minHeight: '280px' }}>
        <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.5), rgba(10,10,10,0.95))' }} />
        <div className="relative z-10 max-w-5xl mx-auto px-4 py-12 text-center">
          {empresa?.logo_url && <img src={empresa.logo_url} alt="" className="h-16 w-16 rounded-full object-cover mx-auto mb-3 border-2" style={{ borderColor: '#e63946' }} />}
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: '#e63946' }}>{empresa?.nome || 'Cardápio Digital'}</h1>
          {empresa?.slogan && <p className="text-sm md:text-base mb-4 opacity-80">{empresa.slogan}</p>}
          <div className="flex items-center justify-center gap-4 flex-wrap text-xs">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold ${isOpen ? 'text-white' : 'text-gray-400'}`} style={{ background: isOpen ? '#16a34a' : '#333' }}>
              <Store className="h-3.5 w-3.5" /> {isOpen ? 'Aberto' : 'Fechado'}
            </span>
            {empresa?.tempo_medio_entrega && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: '#1a1a1a' }}>
                <Clock className="h-3.5 w-3.5" style={{ color: '#e63946' }} /> {empresa.tempo_medio_entrega}
              </span>
            )}
            {empresa?.valor_minimo_pedido && empresa.valor_minimo_pedido > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: '#1a1a1a' }}>
                <DollarSign className="h-3.5 w-3.5" style={{ color: '#e63946' }} /> Mín. {formatCurrency(empresa.valor_minimo_pedido)}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Category bar with custom scrollbar */}
      <div className="sticky top-14 z-40 border-b" style={{ background: '#0a0a0a', borderColor: '#222' }}>
        <div className="max-w-5xl mx-auto">
          <div
            ref={catBarRef}
            className="flex gap-2 overflow-x-auto px-4 py-3 cardapio-cat-scroll touch-pan-x"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {groupedByCategory.map(g => (
              <button
                key={g.cat.id}
                onClick={() => scrollToCategory(g.cat.id)}
                className="whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all shrink-0"
                style={{
                  background: activeCat === g.cat.id ? '#e63946' : '#1a1a1a',
                  color: activeCat === g.cat.id ? '#fff' : '#aaa',
                }}
              >
                {g.cat.nome}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#666' }} />
          <input
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border-none outline-none"
            style={{ background: '#1a1a1a', color: '#f5f5f5' }}
            placeholder="Buscar produto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Products by category - horizontal cards */}
      <div className="max-w-5xl mx-auto px-4 pb-24">
        {groupedByCategory.map(g => (
          <div key={g.cat.id} ref={el => { sectionRefs.current[g.cat.id] = el; }} className="mb-8 scroll-mt-32">
            <h2 className="text-xl font-bold mb-4" style={{ color: '#e63946' }}>{g.cat.nome}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {g.items.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex gap-3 rounded-xl p-2 cursor-pointer transition-transform hover:scale-[1.01]"
                  style={{ background: '#141414', border: '1px solid #222' }}
                  onClick={() => { if (p.ativo) { setSelectedProduto(p); setModalQty(1); setModalObs(''); } }}
                >
                  {/* Image */}
                  <div className="relative w-24 h-24 md:w-28 md:h-28 shrink-0 rounded-lg overflow-hidden">
                    <img src={p.imagem_url || placeholderImg} alt={p.nome} className="w-full h-full object-cover" />
                    <div className="absolute top-1 left-1 flex flex-col gap-1">
                      {!p.ativo && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: '#555', color: '#ccc' }}>Indisponível</span>}
                      {p.ativo && (p as any).mais_pedido && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ background: '#e63946' }}>Mais Pedido</span>}
                      {p.ativo && (p as any).novidade && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ background: '#e63946' }}>Novidade</span>}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-center min-w-0 py-1">
                    <h3 className="font-bold text-sm mb-1 line-clamp-2">{p.nome}</h3>
                    <div className="mt-auto flex items-center justify-between">
                      <div>
                        {p.promocao_ativa && p.preco_promocional ? (
                          <span className="text-sm font-bold" style={{ color: '#e63946' }}>A partir de {formatCurrency(p.preco_promocional)}</span>
                        ) : (
                          <span className="text-sm font-bold" style={{ color: '#e63946' }}>A partir de {formatCurrency(p.preco_venda)}</span>
                        )}
                      </div>
                      {p.ativo && (
                        <span className="flex items-center justify-center h-7 w-7 rounded-full shrink-0" style={{ background: '#e63946' }}>
                          <Plus className="h-4 w-4 text-white" />
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
        {groupedByCategory.length === 0 && (
          <p className="text-center py-12" style={{ color: '#666' }}>Nenhum produto encontrado</p>
        )}
      </div>

      {/* Product modal */}
      <Dialog open={!!selectedProduto} onOpenChange={v => { if (!v) setSelectedProduto(null); }}>
        <DialogContent className="p-0 overflow-hidden max-w-md border-0" style={{ background: '#141414', color: '#f5f5f5' }}>
          {selectedProduto && (
            <>
              <div className="relative aspect-video">
                <img src={selectedProduto.imagem_url || placeholderImg} alt={selectedProduto.nome} className="w-full h-full object-cover" />
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">{selectedProduto.nome}</h3>
                  {selectedProduto.descricao && <p className="text-sm" style={{ color: '#888' }}>{selectedProduto.descricao}</p>}
                </div>
                <div className="text-lg font-bold" style={{ color: '#e63946' }}>
                  {formatCurrency(getPrice(selectedProduto))}
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#aaa' }}>Observação</label>
                  <textarea
                    className="w-full rounded-lg border-none p-3 text-sm resize-none outline-none"
                    style={{ background: '#1a1a1a', color: '#f5f5f5' }}
                    rows={2}
                    placeholder="Ex: sem cebola, molho à parte..."
                    value={modalObs}
                    onChange={e => setModalObs(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 rounded-lg px-2 py-1" style={{ background: '#1a1a1a' }}>
                    <button onClick={() => setModalQty(q => Math.max(1, q - 1))} className="p-1 rounded" style={{ color: '#e63946' }}><Minus className="h-4 w-4" /></button>
                    <span className="font-bold text-lg w-6 text-center">{modalQty}</span>
                    <button onClick={() => setModalQty(q => q + 1)} className="p-1 rounded" style={{ color: '#e63946' }}><Plus className="h-4 w-4" /></button>
                  </div>
                  <button
                    onClick={addToCart}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-opacity"
                    style={{ background: '#e63946' }}
                  >
                    Adicionar {formatCurrency(getPrice(selectedProduto) * modalQty)}
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cart side sheet */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:w-[400px] p-0 border-l flex flex-col" style={{ background: '#141414', color: '#f5f5f5', borderColor: '#222' }}>
          <SheetHeader className="p-4 border-b" style={{ borderColor: '#222' }}>
            <SheetTitle style={{ color: '#e63946' }}>Carrinho ({cartCount})</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 && <p className="text-center py-8" style={{ color: '#666' }}>Seu carrinho está vazio</p>}
            {cart.map((item, idx) => (
              <div key={idx} className="flex gap-3 rounded-xl p-3" style={{ background: '#1a1a1a' }}>
                <img src={item.produto.imagem_url || placeholderImg} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{item.produto.nome}</p>
                  {item.observacao && <p className="text-[10px] italic truncate" style={{ color: '#888' }}>{item.observacao}</p>}
                  <p className="text-sm font-bold mt-1" style={{ color: '#e63946' }}>{formatCurrency(getPrice(item.produto) * item.quantidade)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => updateCartQty(idx, -1)} className="p-0.5 rounded" style={{ color: '#e63946' }}><Minus className="h-3.5 w-3.5" /></button>
                    <span className="text-sm font-bold w-4 text-center">{item.quantidade}</span>
                    <button onClick={() => updateCartQty(idx, 1)} className="p-0.5 rounded" style={{ color: '#e63946' }}><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <button onClick={() => removeFromCart(idx)} className="self-start p-1" style={{ color: '#555' }}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          {cart.length > 0 && (
            <div className="p-4 border-t space-y-3" style={{ borderColor: '#222' }}>
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span style={{ color: '#e63946' }}>{formatCurrency(cartTotal)}</span>
              </div>
              {empresa?.valor_minimo_pedido && cartTotal < empresa.valor_minimo_pedido ? (
                <p className="text-xs text-center" style={{ color: '#e63946' }}>Pedido mínimo: {formatCurrency(empresa.valor_minimo_pedido)}</p>
              ) : (
                <button
                  onClick={() => { setDrawerOpen(false); setCheckoutOpen(true); setCheckoutStep(1); }}
                  disabled={!isOpen}
                  className="w-full py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50"
                  style={{ background: '#e63946' }}
                >
                  {isOpen ? 'Finalizar Pedido' : 'Restaurante Fechado'}
                </button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Checkout modal */}
      <Dialog open={checkoutOpen} onOpenChange={v => { if (!v) setCheckoutOpen(false); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0" style={{ background: '#141414', color: '#f5f5f5' }}>
          {/* Steps indicator */}
          <div className="flex items-center gap-1 px-5 pt-5">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex-1 h-1 rounded-full transition-colors" style={{ background: s <= checkoutStep ? '#e63946' : '#333' }} />
            ))}
          </div>

          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Step 1 - Dados */}
            {checkoutStep === 1 && (
              <>
                <h3 className="font-bold text-lg" style={{ color: '#e63946' }}>Seus dados</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: '#aaa' }}>Nome completo *</label>
                    <input className="w-full rounded-lg p-3 text-sm outline-none border-none" style={{ background: '#1a1a1a', color: '#f5f5f5' }} value={checkoutData.nome} onChange={e => setCheckoutData(d => ({ ...d, nome: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: '#aaa' }}>Telefone *</label>
                    <input className="w-full rounded-lg p-3 text-sm outline-none border-none" style={{ background: '#1a1a1a', color: '#f5f5f5' }} value={checkoutData.telefone} onChange={e => setCheckoutData(d => ({ ...d, telefone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: '#aaa' }}>Tipo de entrega</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['entrega', 'retirada'].map(t => (
                        <button key={t} onClick={() => setCheckoutData(d => ({ ...d, tipo_entrega: t }))} className="p-3 rounded-lg text-sm font-medium transition-colors" style={{ background: checkoutData.tipo_entrega === t ? '#e63946' : '#1a1a1a', color: checkoutData.tipo_entrega === t ? '#fff' : '#aaa' }}>
                          {t === 'entrega' ? '🚗 Entrega' : '🏪 Retirada'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button disabled={!canProceedStep1} onClick={() => setCheckoutStep(checkoutData.tipo_entrega === 'retirada' ? 3 : 2)} className="w-full py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50" style={{ background: '#e63946' }}>
                  Continuar <ChevronRight className="h-4 w-4 inline" />
                </button>
              </>
            )}

            {/* Step 2 - Endereço */}
            {checkoutStep === 2 && (
              <>
                <h3 className="font-bold text-lg" style={{ color: '#e63946' }}>Endereço de entrega</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: '#aaa' }}>CEP</label>
                    <input className="w-full rounded-lg p-3 text-sm outline-none border-none" style={{ background: '#1a1a1a', color: '#f5f5f5' }} placeholder="00000-000" value={checkoutData.cep} onChange={e => { setCheckoutData(d => ({ ...d, cep: e.target.value })); if (e.target.value.replace(/\D/g, '').length === 8) fetchCep(e.target.value); }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-xs font-medium mb-1 block" style={{ color: '#aaa' }}>Rua *</label>
                      <input className="w-full rounded-lg p-3 text-sm outline-none border-none" style={{ background: '#1a1a1a', color: '#f5f5f5' }} value={checkoutData.rua} onChange={e => setCheckoutData(d => ({ ...d, rua: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: '#aaa' }}>Nº *</label>
                      <input className="w-full rounded-lg p-3 text-sm outline-none border-none" style={{ background: '#1a1a1a', color: '#f5f5f5' }} value={checkoutData.numero} onChange={e => setCheckoutData(d => ({ ...d, numero: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: '#aaa' }}>Complemento</label>
                    <input className="w-full rounded-lg p-3 text-sm outline-none border-none" style={{ background: '#1a1a1a', color: '#f5f5f5' }} value={checkoutData.complemento} onChange={e => setCheckoutData(d => ({ ...d, complemento: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: '#aaa' }}>Bairro *</label>
                      <input className="w-full rounded-lg p-3 text-sm outline-none border-none" style={{ background: '#1a1a1a', color: '#f5f5f5' }} value={checkoutData.bairro} onChange={e => setCheckoutData(d => ({ ...d, bairro: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: '#aaa' }}>Cidade *</label>
                      <input className="w-full rounded-lg p-3 text-sm outline-none border-none" style={{ background: '#1a1a1a', color: '#f5f5f5' }} value={checkoutData.cidade} onChange={e => setCheckoutData(d => ({ ...d, cidade: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: '#aaa' }}>Referência</label>
                    <input className="w-full rounded-lg p-3 text-sm outline-none border-none" style={{ background: '#1a1a1a', color: '#f5f5f5' }} placeholder="Próximo ao..." value={checkoutData.referencia} onChange={e => setCheckoutData(d => ({ ...d, referencia: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setCheckoutStep(1)} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: '#1a1a1a', color: '#aaa' }}>Voltar</button>
                  <button disabled={!canProceedStep2} onClick={() => setCheckoutStep(3)} className="flex-1 py-3 rounded-xl font-bold text-white disabled:opacity-50" style={{ background: '#e63946' }}>Continuar</button>
                </div>
              </>
            )}

            {/* Step 3 - Pagamento */}
            {checkoutStep === 3 && (
              <>
                <h3 className="font-bold text-lg" style={{ color: '#e63946' }}>Pagamento</h3>
                <div className="grid grid-cols-2 gap-2">
                  {['Pix', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro'].map(f => (
                    <button key={f} onClick={() => setCheckoutData(d => ({ ...d, forma_pagamento: f }))} className="p-3 rounded-lg text-sm font-medium transition-colors text-left" style={{ background: checkoutData.forma_pagamento === f ? '#e63946' : '#1a1a1a', color: checkoutData.forma_pagamento === f ? '#fff' : '#aaa' }}>
                      {f}
                    </button>
                  ))}
                </div>
                {checkoutData.forma_pagamento === 'Dinheiro' && (
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: '#aaa' }}>Precisa de troco? Se sim, para quanto?</label>
                    <input className="w-full rounded-lg p-3 text-sm outline-none border-none" style={{ background: '#1a1a1a', color: '#f5f5f5' }} placeholder="Ex: 100,00" value={checkoutData.troco_para} onChange={e => setCheckoutData(d => ({ ...d, troco_para: e.target.value }))} />
                  </div>
                )}
                {checkoutData.forma_pagamento === 'Pix' && empresa?.chave_pix && (
                  <div className="p-3 rounded-lg space-y-3" style={{ background: '#1a1a1a' }}>
                    <p className="text-xs" style={{ color: '#aaa' }}>Chave Pix:</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(empresa.chave_pix || ''); setPixCopiado(true); setTimeout(() => setPixCopiado(false), 2000); }}
                      className="flex items-center gap-2 w-full p-2.5 rounded-lg transition-colors hover:opacity-80"
                      style={{ background: pixCopiado ? '#1a2a1a' : '#222', border: pixCopiado ? '1px solid #2a4a2a' : '1px solid transparent' }}
                    >
                      <span className="font-mono font-bold text-base flex-1 text-left break-all" style={{ color: '#e63946' }}>{empresa.chave_pix}</span>
                      {pixCopiado ? <Check className="h-5 w-5 shrink-0" style={{ color: '#4ade80' }} /> : <Copy className="h-5 w-5 shrink-0" style={{ color: '#aaa' }} />}
                    </button>
                    {pixCopiado && (
                      <p className="text-xs font-medium text-center" style={{ color: '#4ade80' }}>Chave copiada!</p>
                    )}
                    <div className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: '#2a1a00', border: '1px solid #4a3000' }}>
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                      <p className="text-xs leading-relaxed" style={{ color: '#fbbf24' }}>
                        <strong>Importante:</strong> Realize o pagamento via Pix somente APÓS enviar o pedido pelo WhatsApp. Não esqueça de enviar o comprovante de pagamento na conversa.
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setCheckoutStep(checkoutData.tipo_entrega === 'retirada' ? 1 : 2)} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: '#1a1a1a', color: '#aaa' }}>Voltar</button>
                  <button disabled={!canProceedStep3} onClick={() => setCheckoutStep(4)} className="flex-1 py-3 rounded-xl font-bold text-white disabled:opacity-50" style={{ background: '#e63946' }}>Continuar</button>
                </div>
              </>
            )}

            {/* Step 4 - Resumo */}
            {checkoutStep === 4 && (
              <>
                <h3 className="font-bold text-lg" style={{ color: '#e63946' }}>Resumo do pedido</h3>
                <div className="space-y-2">
                  {cart.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm py-1" style={{ borderBottom: '1px solid #222' }}>
                      <span>{item.quantidade}x {item.produto.nome}</span>
                      <span style={{ color: '#e63946' }}>{formatCurrency(getPrice(item.produto) * item.quantidade)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-base pt-2">
                    <span>Total</span>
                    <span style={{ color: '#e63946' }}>{formatCurrency(cartTotal)}</span>
                  </div>
                </div>
                <div className="rounded-lg p-3 space-y-1 text-xs" style={{ background: '#1a1a1a' }}>
                  <p><span style={{ color: '#aaa' }}>Cliente:</span> {checkoutData.nome}</p>
                  <p><span style={{ color: '#aaa' }}>Telefone:</span> {checkoutData.telefone}</p>
                  <p><span style={{ color: '#aaa' }}>Tipo:</span> {checkoutData.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'}</p>
                  {checkoutData.tipo_entrega === 'entrega' && <p><span style={{ color: '#aaa' }}>Endereço:</span> {checkoutData.rua}, {checkoutData.numero} — {checkoutData.bairro}, {checkoutData.cidade}</p>}
                  <p><span style={{ color: '#aaa' }}>Pagamento:</span> {checkoutData.forma_pagamento}</p>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: '#0a1a0a', border: '1px solid #1a3a1a' }}>
                  <MessageCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#4ade80' }} />
                  <p className="text-xs leading-relaxed" style={{ color: '#86efac' }}>
                    Ao clicar em <strong>"Finalizar"</strong>, o WhatsApp será aberto com uma mensagem pronta do seu pedido. Basta <strong>enviar a mensagem</strong> para confirmar.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setCheckoutStep(3)} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: '#1a1a1a', color: '#aaa' }}>Voltar</button>
                  <button onClick={sendWhatsApp} className="flex-1 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2" style={{ background: '#16a34a' }}>
                    <MessageCircle className="h-4 w-4" /> Finalizar
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating cart button (mobile) */}
      {cartCount > 0 && !drawerOpen && !checkoutOpen && (
        <motion.button
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-4 left-4 right-4 z-50 py-3 rounded-xl font-bold text-white flex items-center justify-between px-5 md:hidden"
          style={{ background: '#e63946' }}
        >
          <span className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Ver carrinho ({cartCount})</span>
          <span>{formatCurrency(cartTotal)}</span>
        </motion.button>
      )}
    </div>
  );
}
