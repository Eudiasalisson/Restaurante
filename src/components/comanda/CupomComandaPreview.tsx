import { Separator } from '@/components/ui/separator';

interface EmpresaInfo {
  nome?: string;
  cnpj?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  logo_url?: string | null;
}

const formaLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'C. Crédito',
  cartao_debito: 'C. Débito',
  pix: 'PIX',
  outro: 'Outro',
};

interface CupomComandaPreviewProps {
  mesaNumero: number | null;
  garcomNome: string | null;
  clienteNome: string | null;
  openedAt: string | null;
  itens: { quantidade: number; produtos: { nome: string } | null; observacao: string | null; preco_unitario: number }[];
  subtotal: number;
  taxaServicoAtiva: boolean;
  taxaServicoValor: number;
  taxaServico: number;
  desconto: number;
  acrescimo: number;
  total: number;
  pagamentos: { forma: string; valor: number; created_at: string | null }[];
  empresa?: EmpresaInfo;
}

export function CupomComandaPreview(p: CupomComandaPreviewProps) {
  const now = new Date();
  const totalPago = p.pagamentos.reduce((s, pg) => s + pg.valor, 0);
  const restante = Math.max(0, p.total - totalPago);

  return (
    <div className="bg-white text-black rounded-md p-4 font-mono text-xs leading-relaxed" style={{ width: '280px' }}>
      {p.empresa?.logo_url && (
        <div className="text-center mb-2">
          <img src={p.empresa.logo_url} alt="Logo" className="h-10 w-10 rounded object-cover mx-auto" />
        </div>
      )}
      <div className="text-center font-bold text-sm">{p.empresa?.nome || 'COMANDA'}</div>
      {p.empresa?.endereco && <div className="text-center text-[9px]">{p.empresa.endereco}</div>}
      {p.empresa?.telefone && <div className="text-center text-[9px]">Tel: {p.empresa.telefone}</div>}
      {p.empresa?.cnpj && <div className="text-center text-[9px]">CNPJ: {p.empresa.cnpj}</div>}
      <div className="text-center font-bold text-[10px] mt-1">COMANDA</div>
      <Separator className="bg-black/30 my-2" />
      <div className="space-y-0.5">
        {p.mesaNumero != null && <div>Mesa: {p.mesaNumero}</div>}
        {p.clienteNome && <div>Cliente: {p.clienteNome}</div>}
        {p.garcomNome && <div>Garçom: {p.garcomNome}</div>}
        {p.openedAt && (
          <div>Abertura: {new Date(p.openedAt).toLocaleDateString('pt-BR')} {new Date(p.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
        )}
      </div>
      <Separator className="bg-black/30 my-2" />
      <div className="flex font-bold mb-1">
        <span className="w-8">Qtd</span>
        <span className="flex-1">Item</span>
        <span className="text-right w-16">Valor</span>
      </div>
      {p.itens.map((item, i) => {
        const itemTotal = item.preco_unitario * item.quantidade;
        return (
          <div key={i}>
            <div className="flex">
              <span className="w-8 flex-shrink-0">{item.quantidade}x</span>
              <span className="flex-1 break-words min-w-0">{item.produtos?.nome || '?'}</span>
              <span className="text-right w-16 flex-shrink-0">{itemTotal.toFixed(2)}</span>
            </div>
            {item.observacao && <div className="text-[10px] pl-8 italic break-words">OBS: {item.observacao}</div>}
          </div>
        );
      })}
      <Separator className="bg-black/30 my-2" />
      <div className="flex justify-between"><span>Subtotal:</span><span>R$ {p.subtotal.toFixed(2)}</span></div>
      {p.taxaServicoAtiva && (
        <div className="flex justify-between"><span>Taxa serviço ({p.taxaServicoValor}%):</span><span>R$ {p.taxaServico.toFixed(2)}</span></div>
      )}
      {p.desconto > 0 && (
        <div className="flex justify-between"><span>Desconto:</span><span>- R$ {p.desconto.toFixed(2)}</span></div>
      )}
      {p.acrescimo > 0 && (
        <div className="flex justify-between"><span>Acréscimo:</span><span>+ R$ {p.acrescimo.toFixed(2)}</span></div>
      )}
      <Separator className="bg-black/30 my-2" />
      <div className="flex justify-between font-bold text-sm">
        <span>TOTAL:</span><span>R$ {p.total.toFixed(2)}</span>
      </div>

      {p.pagamentos.length > 0 && (
        <>
          <Separator className="bg-black/30 my-2" />
          <div className="font-bold mb-1">PAGAMENTOS</div>
          {p.pagamentos.map((pg, i) => (
            <div key={i} className="flex justify-between">
              <span>{formaLabels[pg.forma] || pg.forma}</span>
              <span>R$ {pg.valor.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between mt-1">
            <span>Total pago:</span><span>R$ {totalPago.toFixed(2)}</span>
          </div>
          {restante > 0.01 && (
            <div className="flex justify-between font-bold">
              <span>Restante:</span><span>R$ {restante.toFixed(2)}</span>
            </div>
          )}
        </>
      )}
      <Separator className="bg-black/30 my-2" />
      <div className="text-center text-[10px]">
        Impresso em {now.toLocaleDateString('pt-BR')} às {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="text-center text-[10px] mt-1">Obrigado pela preferência!</div>
    </div>
  );
}
