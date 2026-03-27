import { Separator } from '@/components/ui/separator';

interface EmpresaInfo {
  nome?: string;
  cnpj?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  logo_url?: string | null;
}

interface CupomCozinhaPreviewProps {
  mesaNumero: number | null;
  garcomNome: string | null;
  clienteNome?: string | null;
  openedAt: string | null;
  itens: { quantidade: number; produtos: { nome: string; descricao?: string | null } | null; observacao: string | null; status?: string | null }[];
  empresa?: EmpresaInfo;
}

export function CupomCozinhaPreview({ mesaNumero, garcomNome, clienteNome, openedAt, itens, empresa }: CupomCozinhaPreviewProps) {
  const activeItens = itens.filter((i: any) => i.status !== 'cancelado');
  const now = new Date();

  return (
    <div className="bg-white text-black rounded-md p-4 font-mono text-xs leading-relaxed" style={{ width: '280px' }}>
      {empresa?.logo_url && (
        <div className="text-center mb-2">
          <img src={empresa.logo_url} alt="Logo" className="h-10 w-10 rounded object-cover mx-auto" />
        </div>
      )}
      <div className="text-center font-bold text-sm mb-1">{empresa?.nome || 'Restaurante'}</div>
      <div className="text-center text-[10px] mb-2">CUPOM - COZINHA</div>
      <Separator className="bg-black/30 my-2" />
      <div className="space-y-0.5">
        <div>Mesa: {mesaNumero ?? '?'}</div>
        {clienteNome && <div>Cliente: {clienteNome}</div>}
        <div>Garçom: {garcomNome || '-'}</div>
        {openedAt && (
          <div>Abertura: {new Date(openedAt).toLocaleDateString('pt-BR')} {new Date(openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
        )}
      </div>
      <Separator className="bg-black/30 my-2" />
      <div className="font-bold mb-1">Qtd  Item</div>
      {activeItens.map((item, i) => (
        <div key={i}>
          <div className="break-words">{item.quantidade}x  {item.produtos?.nome || '-'}</div>
          {item.produtos?.descricao && <div className="text-[10px] pl-4 italic text-gray-600 break-words">{item.produtos.descricao}</div>}
          {item.observacao && <div className="text-[10px] pl-4 italic break-words">Obs: {item.observacao}</div>}
          {i < activeItens.length - 1 && (
            <div className="border-b border-dashed border-black/30 my-1.5" />
          )}
        </div>
      ))}
      <Separator className="bg-black/30 my-2" />
      <div className="text-center text-[10px]">
        Enviado em {now.toLocaleDateString('pt-BR')} às {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
