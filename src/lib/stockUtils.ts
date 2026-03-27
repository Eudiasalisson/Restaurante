import { supabase } from '@/integrations/supabase/client';

/**
 * Helper to update stock via RPC (bypasses trigger to avoid double movement)
 */
async function updateStockViaRPC(
  produtoId: string,
  novoEstoque: number,
  tipo: 'entrada' | 'saida',
  quantidade: number,
  motivo: string,
  userId: string | null
) {
  const { error } = await supabase.rpc('update_stock', {
    p_produto_id: produtoId,
    p_novo_estoque: novoEstoque,
    p_tipo: tipo,
    p_quantidade: quantidade,
    p_motivo: motivo,
    p_usuario_id: userId,
  });
  if (error) {
    console.error('Erro ao atualizar estoque via RPC:', error);
  }
}

/**
 * Deducts stock for products that have controle_estoque enabled.
 */
export async function deductStock(
  items: { produto_id: string; quantidade: number }[],
  userId: string | null
) {
  if (items.length === 0) return;

  const prodIds = [...new Set(items.map(i => i.produto_id))];
  const { data: produtos } = await supabase
    .from('produtos')
    .select('id, nome, controle_estoque, estoque_atual')
    .in('id', prodIds);

  if (!produtos) return;

  const stockProducts = produtos.filter(p => p.controle_estoque);
  if (stockProducts.length === 0) return;

  const stockMap = new Map(stockProducts.map(p => [p.id, p]));

  for (const item of items) {
    const prod = stockMap.get(item.produto_id);
    if (!prod) continue;

    const novoEstoque = (prod.estoque_atual || 0) - item.quantidade;

    await updateStockViaRPC(
      prod.id, novoEstoque, 'saida', item.quantidade,
      'Venda (baixa automática)', userId
    );

    prod.estoque_atual = novoEstoque;
  }
}

/**
 * Restores stock for products that have controle_estoque enabled.
 */
export async function restoreStock(
  items: { produto_id: string; quantidade: number }[],
  userId: string | null,
  motivo: string = 'Estorno (item cancelado/removido)'
) {
  if (items.length === 0) return;

  const prodIds = [...new Set(items.map(i => i.produto_id))];
  const { data: produtos } = await supabase
    .from('produtos')
    .select('id, nome, controle_estoque, estoque_atual')
    .in('id', prodIds);

  if (!produtos) return;

  const stockProducts = produtos.filter(p => p.controle_estoque);
  if (stockProducts.length === 0) return;

  const stockMap = new Map(stockProducts.map(p => [p.id, p]));

  for (const item of items) {
    const prod = stockMap.get(item.produto_id);
    if (!prod) continue;

    const novoEstoque = (prod.estoque_atual || 0) + item.quantidade;

    await updateStockViaRPC(
      prod.id, novoEstoque, 'entrada', item.quantidade,
      motivo, userId
    );

    prod.estoque_atual = novoEstoque;
  }
}

/**
 * Adjusts stock when item quantity changes.
 * Only adjusts if the item was already deducted (status = enviado_cozinha or entregue).
 */
export async function adjustStockForQtyChange(
  produtoId: string,
  oldQtd: number,
  newQtd: number,
  itemStatus: string | null,
  userId: string | null
) {
  if (!itemStatus || !['enviado_cozinha', 'entregue'].includes(itemStatus)) return;

  const diff = newQtd - oldQtd;
  if (diff === 0) return;

  if (diff < 0) {
    await restoreStock(
      [{ produto_id: produtoId, quantidade: Math.abs(diff) }],
      userId,
      `Estorno (quantidade reduzida de ${oldQtd} para ${newQtd})`
    );
  } else {
    await deductStock(
      [{ produto_id: produtoId, quantidade: diff }],
      userId
    );
  }
}

/**
 * Deducts stock for items still pending when closing a comanda/delivery.
 */
export async function deductStockForClosing(
  items: { produto_id: string; quantidade: number; status: string | null }[],
  userId: string | null
) {
  const pending = items.filter(i => i.status === 'pendente');
  if (pending.length === 0) return;

  await deductStock(
    pending.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
    userId
  );
}

/**
 * Restores stock for all deducted items when cancelling a comanda/delivery.
 */
export async function restoreStockForCancellation(
  items: { produto_id: string; quantidade: number; status: string | null }[],
  userId: string | null
) {
  const deducted = items.filter(i => i.status && ['enviado_cozinha', 'entregue'].includes(i.status));
  if (deducted.length === 0) return;

  await restoreStock(
    deducted.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
    userId,
    'Estorno (comanda/pedido cancelado)'
  );
}
