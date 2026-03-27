
CREATE OR REPLACE FUNCTION public.track_estoque_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  diff integer;
  mov_tipo text;
  skip_tracking text;
BEGIN
  -- Allow programmatic stock changes to skip trigger-based tracking
  -- by setting session variable: SET LOCAL app.skip_stock_tracking = 'true'
  BEGIN
    skip_tracking := current_setting('app.skip_stock_tracking', true);
  EXCEPTION WHEN OTHERS THEN
    skip_tracking := '';
  END;
  
  IF skip_tracking = 'true' THEN
    RETURN NEW;
  END IF;

  -- Only act when estoque_atual actually changes and controle_estoque is on
  IF NEW.controle_estoque = true AND 
     (OLD.estoque_atual IS DISTINCT FROM NEW.estoque_atual) THEN
    
    diff := COALESCE(NEW.estoque_atual, 0) - COALESCE(OLD.estoque_atual, 0);
    
    IF diff > 0 THEN
      mov_tipo := 'entrada';
    ELSIF diff < 0 THEN
      mov_tipo := 'saida';
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.estoque_movimentacoes (produto_id, tipo, quantidade, motivo)
    VALUES (NEW.id, mov_tipo, ABS(diff), 'Ajuste manual (cadastro do produto)');
  END IF;

  -- Also track when controle_estoque is first enabled and estoque_atual > 0
  IF NEW.controle_estoque = true AND OLD.controle_estoque = false AND COALESCE(NEW.estoque_atual, 0) > 0 THEN
    INSERT INTO public.estoque_movimentacoes (produto_id, tipo, quantidade, motivo)
    VALUES (NEW.id, 'entrada', COALESCE(NEW.estoque_atual, 0), 'Estoque inicial (controle ativado)');
  END IF;

  RETURN NEW;
END;
$$;
