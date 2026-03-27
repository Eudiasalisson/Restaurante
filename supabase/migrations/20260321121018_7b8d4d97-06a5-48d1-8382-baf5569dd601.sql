
-- Corrigir estoque_atual para todos os produtos que tiveram movimentações não aplicadas
-- Usa set_config para evitar que o trigger crie movimentações duplicadas
DO $$
DECLARE
  r RECORD;
BEGIN
  PERFORM set_config('app.skip_stock_tracking', 'true', true);
  
  FOR r IN
    WITH movement_net AS (
      SELECT 
        produto_id,
        COALESCE(SUM(CASE WHEN tipo='saida' THEN quantidade ELSE 0 END),0) -
        COALESCE(SUM(CASE WHEN tipo='entrada' THEN quantidade ELSE 0 END),0) as net_saidas
      FROM estoque_movimentacoes 
      GROUP BY produto_id
    )
    SELECT p.id, p.estoque_atual, m.net_saidas, p.estoque_atual - m.net_saidas as corrected
    FROM produtos p
    JOIN movement_net m ON m.produto_id = p.id
    WHERE p.controle_estoque = true
    AND m.net_saidas > 0
  LOOP
    UPDATE produtos SET estoque_atual = r.corrected WHERE id = r.id;
  END LOOP;
  
  PERFORM set_config('app.skip_stock_tracking', '', true);
END;
$$;
