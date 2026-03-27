
-- RPC to update stock programmatically, bypassing the trigger's movement insert
CREATE OR REPLACE FUNCTION public.update_stock(
  p_produto_id uuid,
  p_novo_estoque integer,
  p_tipo text,
  p_quantidade integer,
  p_motivo text,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Set session variable to skip trigger tracking
  PERFORM set_config('app.skip_stock_tracking', 'true', true);
  
  -- Update stock
  UPDATE public.produtos SET estoque_atual = p_novo_estoque WHERE id = p_produto_id;
  
  -- Insert movement record
  INSERT INTO public.estoque_movimentacoes (produto_id, tipo, quantidade, motivo, usuario_id)
  VALUES (p_produto_id, p_tipo, p_quantidade, p_motivo, p_usuario_id);
  
  -- Reset
  PERFORM set_config('app.skip_stock_tracking', '', true);
END;
$$;
