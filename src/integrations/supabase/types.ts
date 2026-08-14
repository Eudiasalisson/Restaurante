export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      caixa_movimentacoes: {
        Row: {
          caixa_id: string
          created_at: string
          descricao: string
          id: string
          tipo: string
          usuario_id: string | null
          valor: number
        }
        Insert: {
          caixa_id: string
          created_at?: string
          descricao: string
          id?: string
          tipo: string
          usuario_id?: string | null
          valor: number
        }
        Update: {
          caixa_id?: string
          created_at?: string
          descricao?: string
          id?: string
          tipo?: string
          usuario_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "caixa_movimentacoes_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_movimentacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      caixas: {
        Row: {
          aberto_por: string | null
          closed_at: string | null
          fechado_por: string | null
          id: string
          observacao_abertura: string | null
          observacao_fechamento: string | null
          opened_at: string
          status: string
          valor_abertura: number
          valor_fechamento: number | null
        }
        Insert: {
          aberto_por?: string | null
          closed_at?: string | null
          fechado_por?: string | null
          id?: string
          observacao_abertura?: string | null
          observacao_fechamento?: string | null
          opened_at?: string
          status?: string
          valor_abertura?: number
          valor_fechamento?: number | null
        }
        Update: {
          aberto_por?: string | null
          closed_at?: string | null
          fechado_por?: string | null
          id?: string
          observacao_abertura?: string | null
          observacao_fechamento?: string | null
          opened_at?: string
          status?: string
          valor_abertura?: number
          valor_fechamento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "caixas_aberto_por_fkey"
            columns: ["aberto_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixas_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          ativo: boolean | null
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cpf: string | null
          created_at: string | null
          email: string | null
          id: string
          nome: string
          telefone: string | null
          whatsapp: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          whatsapp?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      comanda_historico: {
        Row: {
          acao: string
          comanda_id: string
          created_at: string | null
          descricao: string | null
          id: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          comanda_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          comanda_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comanda_historico_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comanda_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      comanda_itens: {
        Row: {
          added_at: string | null
          comanda_id: string
          id: string
          observacao: string | null
          preco_unitario: number
          produto_id: string
          quantidade: number
          status: Database["public"]["Enums"]["comanda_item_status"] | null
        }
        Insert: {
          added_at?: string | null
          comanda_id: string
          id?: string
          observacao?: string | null
          preco_unitario?: number
          produto_id: string
          quantidade?: number
          status?: Database["public"]["Enums"]["comanda_item_status"] | null
        }
        Update: {
          added_at?: string | null
          comanda_id?: string
          id?: string
          observacao?: string | null
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          status?: Database["public"]["Enums"]["comanda_item_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "comanda_itens_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comanda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      comandas: {
        Row: {
          acrescimo: number | null
          cliente_id: string | null
          closed_at: string | null
          desconto: number | null
          funcionario_consumo_id: string | null
          funcionario_id: string | null
          id: string
          mesa_id: string | null
          numero: number | null
          opened_at: string | null
          pessoas: number | null
          status: Database["public"]["Enums"]["comanda_status"] | null
          taxa_servico_ativa: boolean | null
          taxa_servico_valor: number | null
        }
        Insert: {
          acrescimo?: number | null
          cliente_id?: string | null
          closed_at?: string | null
          desconto?: number | null
          funcionario_consumo_id?: string | null
          funcionario_id?: string | null
          id?: string
          mesa_id?: string | null
          numero?: number | null
          opened_at?: string | null
          pessoas?: number | null
          status?: Database["public"]["Enums"]["comanda_status"] | null
          taxa_servico_ativa?: boolean | null
          taxa_servico_valor?: number | null
        }
        Update: {
          acrescimo?: number | null
          cliente_id?: string | null
          closed_at?: string | null
          desconto?: number | null
          funcionario_consumo_id?: string | null
          funcionario_id?: string | null
          id?: string
          mesa_id?: string | null
          numero?: number | null
          opened_at?: string | null
          pessoas?: number | null
          status?: Database["public"]["Enums"]["comanda_status"] | null
          taxa_servico_ativa?: boolean | null
          taxa_servico_valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comandas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comandas_funcionario_consumo_id_fkey"
            columns: ["funcionario_consumo_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comandas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comandas_mesa_id_fkey"
            columns: ["mesa_id"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          cardapio_status: string | null
          chave_pix: string | null
          cnpj: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          mensagem_conclusao: string | null
          nfce_ambiente: string
          nome: string
          slogan: string | null
          taxa_servico_padrao: number | null
          telefone: string | null
          tempo_medio_entrega: string | null
          valor_minimo_pedido: number | null
          whatsapp_pedidos: string | null
        }
        Insert: {
          cardapio_status?: string | null
          chave_pix?: string | null
          cnpj?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          mensagem_conclusao?: string | null
          nfce_ambiente?: string
          nome: string
          slogan?: string | null
          taxa_servico_padrao?: number | null
          telefone?: string | null
          tempo_medio_entrega?: string | null
          valor_minimo_pedido?: number | null
          whatsapp_pedidos?: string | null
        }
        Update: {
          cardapio_status?: string | null
          chave_pix?: string | null
          cnpj?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          mensagem_conclusao?: string | null
          nfce_ambiente?: string
          nome?: string
          slogan?: string | null
          taxa_servico_padrao?: number | null
          telefone?: string | null
          tempo_medio_entrega?: string | null
          valor_minimo_pedido?: number | null
          whatsapp_pedidos?: string | null
        }
        Relationships: []
      }
      enderecos_cliente: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_id: string
          complemento: string | null
          id: string
          label: string | null
          logradouro: string | null
          numero: string | null
          principal: boolean | null
          uf: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id: string
          complemento?: string | null
          id?: string
          label?: string | null
          logradouro?: string | null
          numero?: string | null
          principal?: boolean | null
          uf?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string
          complemento?: string | null
          id?: string
          label?: string | null
          logradouro?: string | null
          numero?: string | null
          principal?: boolean | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enderecos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      entrega_historico: {
        Row: {
          acao: string
          created_at: string | null
          descricao: string | null
          entrega_id: string
          id: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          descricao?: string | null
          entrega_id: string
          id?: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          descricao?: string | null
          entrega_id?: string
          id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entrega_historico_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrega_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      entrega_itens: {
        Row: {
          entrega_id: string
          id: string
          observacao: string | null
          preco_unitario: number
          produto_id: string
          quantidade: number
          status: Database["public"]["Enums"]["comanda_item_status"] | null
        }
        Insert: {
          entrega_id: string
          id?: string
          observacao?: string | null
          preco_unitario?: number
          produto_id: string
          quantidade?: number
          status?: Database["public"]["Enums"]["comanda_item_status"] | null
        }
        Update: {
          entrega_id?: string
          id?: string
          observacao?: string | null
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          status?: Database["public"]["Enums"]["comanda_item_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "entrega_itens_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrega_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas: {
        Row: {
          cliente_id: string | null
          endereco_id: string | null
          forma_pagamento: string | null
          funcionario_consumo_id: string | null
          funcionario_id: string | null
          id: string
          numero: number | null
          opened_at: string | null
          status: Database["public"]["Enums"]["entrega_status"] | null
          taxa_entrega: number | null
        }
        Insert: {
          cliente_id?: string | null
          endereco_id?: string | null
          forma_pagamento?: string | null
          funcionario_consumo_id?: string | null
          funcionario_id?: string | null
          id?: string
          numero?: number | null
          opened_at?: string | null
          status?: Database["public"]["Enums"]["entrega_status"] | null
          taxa_entrega?: number | null
        }
        Update: {
          cliente_id?: string | null
          endereco_id?: string | null
          forma_pagamento?: string | null
          funcionario_consumo_id?: string | null
          funcionario_id?: string | null
          id?: string
          numero?: number | null
          opened_at?: string | null
          status?: Database["public"]["Enums"]["entrega_status"] | null
          taxa_entrega?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entregas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_endereco_id_fkey"
            columns: ["endereco_id"]
            isOneToOne: false
            referencedRelation: "enderecos_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_funcionario_consumo_id_fkey"
            columns: ["funcionario_consumo_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string
          id: string
          motivo: string | null
          produto_id: string
          quantidade: number
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          motivo?: string | null
          produto_id: string
          quantidade: number
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string | null
          produto_id?: string
          quantidade?: number
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionario_pagamentos: {
        Row: {
          created_at: string
          descricao: string | null
          forma: string
          funcionario_id: string
          id: string
          valor: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          forma: string
          funcionario_id: string
          id?: string
          valor: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          forma?: string
          funcionario_id?: string
          id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "funcionario_pagamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          ativo: boolean | null
          cargo: string | null
          cpf: string | null
          created_at: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string | null
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      mesas: {
        Row: {
          capacidade: number | null
          id: string
          numero: number
          status: Database["public"]["Enums"]["mesa_status"] | null
        }
        Insert: {
          capacidade?: number | null
          id?: string
          numero: number
          status?: Database["public"]["Enums"]["mesa_status"] | null
        }
        Update: {
          capacidade?: number | null
          id?: string
          numero?: number
          status?: Database["public"]["Enums"]["mesa_status"] | null
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          comanda_id: string | null
          created_at: string | null
          entrega_id: string | null
          forma: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          valor: number
        }
        Insert: {
          comanda_id?: string | null
          created_at?: string | null
          entrega_id?: string | null
          forma: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          valor: number
        }
        Update: {
          comanda_id?: string | null
          created_at?: string | null
          entrega_id?: string | null
          forma?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "entregas"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_usuario: {
        Row: {
          id: string
          modulo: string
          pode_criar: boolean
          pode_editar: boolean
          pode_excluir: boolean
          pode_visualizar: boolean
          usuario_id: string
        }
        Insert: {
          id?: string
          modulo: string
          pode_criar?: boolean
          pode_editar?: boolean
          pode_excluir?: boolean
          pode_visualizar?: boolean
          usuario_id: string
        }
        Update: {
          id?: string
          modulo?: string
          pode_criar?: boolean
          pode_editar?: boolean
          pode_excluir?: boolean
          pode_visualizar?: boolean
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissoes_usuario_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          aliquota_icms: number | null
          ativo: boolean | null
          categoria_id: string | null
          cfop: string | null
          codigo: number | null
          controle_estoque: boolean | null
          cst_csosn: string | null
          descricao: string | null
          enviar_cozinha: boolean | null
          estoque_atual: number | null
          estoque_minimo: number | null
          exibir_cardapio: boolean | null
          id: string
          imagem_url: string | null
          mais_pedido: boolean | null
          ncm: string | null
          nome: string
          novidade: boolean | null
          preco_custo: number | null
          preco_promocional: number | null
          preco_venda: number
          promocao_ativa: boolean | null
          unidade: string | null
        }
        Insert: {
          aliquota_icms?: number | null
          ativo?: boolean | null
          categoria_id?: string | null
          cfop?: string | null
          codigo?: number | null
          controle_estoque?: boolean | null
          cst_csosn?: string | null
          descricao?: string | null
          enviar_cozinha?: boolean | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          exibir_cardapio?: boolean | null
          id?: string
          imagem_url?: string | null
          mais_pedido?: boolean | null
          ncm?: string | null
          nome: string
          novidade?: boolean | null
          preco_custo?: number | null
          preco_promocional?: number | null
          preco_venda?: number
          promocao_ativa?: boolean | null
          unidade?: string | null
        }
        Update: {
          aliquota_icms?: number | null
          ativo?: boolean | null
          categoria_id?: string | null
          cfop?: string | null
          codigo?: number | null
          controle_estoque?: boolean | null
          cst_csosn?: string | null
          descricao?: string | null
          enviar_cozinha?: boolean | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          exibir_cardapio?: boolean | null
          id?: string
          imagem_url?: string | null
          mais_pedido?: boolean | null
          ncm?: string | null
          nome?: string
          novidade?: boolean | null
          preco_custo?: number | null
          preco_promocional?: number | null
          preco_venda?: number
          promocao_ativa?: boolean | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          ambiente: string
          chave_acesso: string | null
          comanda_id: string | null
          created_at: string
          criada_por: string | null
          cstat: string | null
          entrega_id: string | null
          erro_mensagem: string | null
          id: string
          invoice_id: string | null
          motivo_cancelamento: string | null
          numero: string | null
          pdf_url: string | null
          protocolo: string | null
          status: Database["public"]["Enums"]["nota_fiscal_status"]
          updated_at: string
          valor_total: number | null
          xml_url: string | null
          xmotivo: string | null
        }
        Insert: {
          ambiente?: string
          chave_acesso?: string | null
          comanda_id?: string | null
          created_at?: string
          criada_por?: string | null
          cstat?: string | null
          entrega_id?: string | null
          erro_mensagem?: string | null
          id?: string
          invoice_id?: string | null
          motivo_cancelamento?: string | null
          numero?: string | null
          pdf_url?: string | null
          protocolo?: string | null
          status?: Database["public"]["Enums"]["nota_fiscal_status"]
          updated_at?: string
          valor_total?: number | null
          xml_url?: string | null
          xmotivo?: string | null
        }
        Update: {
          ambiente?: string
          chave_acesso?: string | null
          comanda_id?: string | null
          created_at?: string
          criada_por?: string | null
          cstat?: string | null
          entrega_id?: string | null
          erro_mensagem?: string | null
          id?: string
          invoice_id?: string | null
          motivo_cancelamento?: string | null
          numero?: string | null
          pdf_url?: string | null
          protocolo?: string | null
          status?: Database["public"]["Enums"]["nota_fiscal_status"]
          updated_at?: string
          valor_total?: number | null
          xml_url?: string | null
          xmotivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_criada_por_fkey"
            columns: ["criada_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean | null
          email: string
          funcionario_id: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          ativo?: boolean | null
          email: string
          funcionario_id?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          ativo?: boolean | null
          email?: string
          funcionario_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_stock: {
        Args: {
          p_motivo: string
          p_novo_estoque: number
          p_produto_id: string
          p_quantidade: number
          p_tipo: string
          p_usuario_id?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      comanda_item_status:
        | "pendente"
        | "enviado_cozinha"
        | "entregue"
        | "cancelado"
      comanda_status: "aberta" | "fechada" | "cancelada"
      entrega_status:
        | "aberta"
        | "em_preparo"
        | "saiu_entrega"
        | "entregue"
        | "cancelada"
      forma_pagamento:
        | "dinheiro"
        | "cartao_credito"
        | "cartao_debito"
        | "pix"
        | "outro"
        | "consumo_funcionario"
      mesa_status: "aberta" | "ocupada" | "reservada" | "fechada"
      nota_fiscal_status:
        | "queued"
        | "processing"
        | "issued"
        | "error"
        | "cancelled"
      user_role: "admin" | "garcom" | "caixa" | "cozinha"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      comanda_item_status: [
        "pendente",
        "enviado_cozinha",
        "entregue",
        "cancelado",
      ],
      comanda_status: ["aberta", "fechada", "cancelada"],
      entrega_status: [
        "aberta",
        "em_preparo",
        "saiu_entrega",
        "entregue",
        "cancelada",
      ],
      forma_pagamento: [
        "dinheiro",
        "cartao_credito",
        "cartao_debito",
        "pix",
        "outro",
        "consumo_funcionario",
      ],
      mesa_status: ["aberta", "ocupada", "reservada", "fechada"],
      nota_fiscal_status: [
        "queued",
        "processing",
        "issued",
        "error",
        "cancelled",
      ],
      user_role: ["admin", "garcom", "caixa", "cozinha"],
    },
  },
} as const
