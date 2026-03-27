import { Separator } from '@/components/ui/separator';

const formaLabels: Record<string, string> = {
  dinheiro: 'Dinheiro', cartao_credito: 'C. Crédito', cartao_debito: 'C. Débito', pix: 'PIX', outro: 'Outro',
};

interface EmpresaInfo {
  nome?: string;
  cnpj?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  logo_url?: string | null;
}

interface CupomEntregaPreviewProps {
  clienteNome: string | null;
  enderecoStr: string | null;
  funcionarioNome: string | null;
  openedAt: string | null;
  itens: { quantidade: number; produtos: { nome: string } | null; observacao: string | null; status?: string | null }[];
  empresa?: EmpresaInfo;
  formaPagamento?: string | null;
  total?: number;
  numeroPedido?: number | null;
}

export function CupomEntregaPreview({ clienteNome, enderecoStr, openedAt, itens, empresa, numeroPedido }: CupomEntregaPreviewProps) {
  const activeItens = itens.filter((i: any) => i.status !== 'cancelado');
  const now = new Date();

  return (
    <div className="bg-white text-black rounded-md p-4 font-mono text-xs leading-relaxed" style={{ width: '280px' }}>
      {empresa?.logo_url && (
        <div className="text-center mb-2">
          <img src={empresa.logo_url} alt="Logo" className="h-10 w-10 rounded object-cover mx-auto" />
        </div>
      )}
      <div className="text-center font-bold text-sm">{empresa?.nome || 'PEDIDO DELIVERY'}</div>
      {empresa?.endereco && <div className="text-center text-[9px]">{empresa.endereco}</div>}
      {empresa?.telefone && <div className="text-center text-[9px]">Tel: {empresa.telefone}</div>}
      <div className="text-center font-bold text-[11px] uppercase mt-1">
        {numeroPedido ? `PEDIDO DELIVERY #D${numeroPedido}` : 'PEDIDO DELIVERY'}
      </div>
      <Separator className="bg-black/30 my-2" />
      <div className="space-y-0.5">
        {clienteNome && <div>Cliente: {clienteNome}</div>}
        {openedAt && (
          <div>Aberto: {new Date(openedAt).toLocaleDateString('pt-BR')} {new Date(openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
        )}
      </div>
      {enderecoStr && (
        <>
          <Separator className="bg-black/30 my-2" />
          <div className="font-bold mb-0.5">ENDEREÇO:</div>
          <div className="font-bold text-[11px] uppercase break-words">{enderecoStr}</div>
        </>
      )}
      <Separator className="bg-black/30 my-2" />
      <div className="font-bold mb-1">ITENS</div>
      {activeItens.map((item, i) => (
        <div key={i}>
          <div className="break-words">{item.quantidade}x {item.produtos?.nome || '?'}</div>
          {item.observacao && <div className="text-[10px] pl-4 italic break-words">OBS: {item.observacao}</div>}
        </div>
      ))}
      <Separator className="bg-black/30 my-2" />
      <div className="text-center text-[10px]">
        Impresso em {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
