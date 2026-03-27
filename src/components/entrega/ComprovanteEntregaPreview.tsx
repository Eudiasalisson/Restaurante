import { Separator } from '@/components/ui/separator';
import { Phone } from 'lucide-react';
import { formatPhone } from '@/lib/formatPhone';

const formaLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'C. Crédito',
  cartao_debito: 'C. Débito',
  pix: 'PIX',
  outro: 'Outro',
};

interface EmpresaInfo {
  nome?: string;
  cnpj?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  logo_url?: string | null;
}

interface ComprovanteEntregaPreviewProps {
  clienteNome: string | null;
  clienteTelefone: string | null;
  clienteWhatsapp: string | null;
  enderecoStr: string | null;
  funcionarioNome: string | null;
  openedAt: string | null;
  itens: { quantidade: number; produtos: { nome: string } | null; observacao: string | null; preco_unitario: number; status?: string | null }[];
  subtotal: number;
  taxaEntrega: number;
  total: number;
  pagamentos: { forma: string; valor: number }[];
  totalPago: number;
  empresa?: EmpresaInfo;
  formaPagamento?: string | null;
  numeroPedido?: number | null;
}

export function ComprovanteEntregaPreview(p: ComprovanteEntregaPreviewProps) {
  const now = new Date();
  const isPago = p.totalPago >= p.total;
  const activeItens = p.itens.filter((i: any) => i.status !== 'cancelado');
  const telefoneDestaque = p.clienteWhatsapp || p.clienteTelefone;

  return (
    <div className="bg-white text-black rounded-md p-4 font-mono text-xs leading-relaxed" style={{ width: '280px' }}>
      {p.empresa?.logo_url && (
        <div className="text-center mb-2">
          <img src={p.empresa.logo_url} alt="Logo" className="h-10 w-10 rounded object-cover mx-auto" />
        </div>
      )}
      <div className="text-center font-bold text-sm">{p.empresa?.nome || 'COMPROVANTE DE ENTREGA'}</div>
      {p.empresa?.endereco && <div className="text-center text-[9px]">{p.empresa.endereco}</div>}
      {p.empresa?.telefone && <div className="text-center text-[9px]">Tel: {p.empresa.telefone}</div>}
      {p.empresa?.cnpj && <div className="text-center text-[9px]">CNPJ: {p.empresa.cnpj}</div>}
      <div className="text-center font-bold text-[11px] uppercase mt-1">
        {p.numeroPedido ? `COMPROVANTE DE ENTREGA #D${p.numeroPedido}` : 'COMPROVANTE DE ENTREGA'}
      </div>
      <Separator className="bg-black/30 my-2" />

      <div className="space-y-0.5">
        {p.clienteNome && <div className="font-bold">Cliente: {p.clienteNome}</div>}
        {telefoneDestaque && (
          <div className="flex items-center gap-1 my-1.5 p-1.5 border-2 border-black rounded bg-gray-100">
            <Phone className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-bold text-sm tracking-wide">{formatPhone(telefoneDestaque)}</span>
          </div>
        )}
        {p.clienteTelefone && p.clienteWhatsapp && p.clienteTelefone !== p.clienteWhatsapp && (
          <div>Tel: {formatPhone(p.clienteTelefone)}</div>
        )}
      </div>

      <Separator className="bg-black/30 my-2" />

      {p.enderecoStr && (
        <>
          <div className="font-bold mb-0.5">ENDEREÇO:</div>
          <div className="my-1.5 border-2 border-black rounded bg-gray-100 px-1.5 py-1.5 overflow-hidden">
            <div className="w-full min-w-0 whitespace-pre-wrap break-all font-bold text-sm leading-tight tracking-wide uppercase" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {p.enderecoStr}
            </div>
          </div>
          <Separator className="bg-black/30 my-2" />
        </>
      )}

      {p.formaPagamento && (
        <>
          <div className="font-bold mb-0.5">FORMA DE PAGAMENTO:</div>
          <div>{formaLabels[p.formaPagamento] || p.formaPagamento}</div>
          {p.formaPagamento === 'dinheiro' && p.total > 0 && (
            <div className="mt-1.5 p-1.5 border-2 border-black rounded bg-gray-100 text-center">
              <div className="font-bold text-sm">💰 DINHEIRO</div>
              <div className="font-bold">Troco para: R$ {p.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          )}
          {(p.formaPagamento === 'cartao_credito' || p.formaPagamento === 'cartao_debito') && (
            <div className="mt-1.5 p-1.5 border-2 border-black rounded bg-gray-100 text-center">
              <div className="font-bold text-sm">⚠️ LEVAR MAQUININHA DE CARTÃO</div>
            </div>
          )}
          <Separator className="bg-black/30 my-2" />
        </>
      )}

      <div className="font-bold mb-1">ITENS ({activeItens.length})</div>
      {activeItens.map((item, i) => (
        <div key={i} className="flex">
          <span className="flex-1 break-words min-w-0">{item.quantidade}x {item.produtos?.nome || '?'}</span>
          <span className="text-right w-20 flex-shrink-0">R$ {(item.preco_unitario * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      ))}

      <Separator className="bg-black/30 my-2" />

      <div className="flex justify-between"><span>Subtotal:</span><span>R$ {p.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      {p.taxaEntrega > 0 && (
        <div className="flex justify-between"><span>Taxa entrega:</span><span>R$ {p.taxaEntrega.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      )}
      <div className="flex justify-between font-bold text-sm mt-1">
        <span>TOTAL:</span><span>R$ {p.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>

      <Separator className="bg-black/30 my-2" />

      <div className="font-bold mb-1">PAGAMENTO:</div>
      {p.pagamentos.length > 0 ? (
        p.pagamentos.map((pg, i) => (
          <div key={i} className="flex justify-between">
            <span>{formaLabels[pg.forma] || pg.forma}</span>
            <span>R$ {pg.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        ))
      ) : (
        <div>Nenhum pagamento registrado</div>
      )}

      <div className={`text-center font-bold text-sm mt-2 p-1.5 rounded border-2 ${isPago ? 'border-green-700 bg-green-50 text-green-800' : 'border-red-700 bg-red-50 text-red-800'}`}>
        {isPago ? '✓ PAGO' : `✗ PENDENTE — R$ ${(p.total - p.totalPago).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} restante`}
      </div>

      <Separator className="bg-black/30 my-2" />

      {p.funcionarioNome && <div className="text-center text-[10px]">Responsável: {p.funcionarioNome}</div>}
      <div className="text-center text-[10px]">
        {now.toLocaleDateString('pt-BR')} às {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
