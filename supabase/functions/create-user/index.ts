import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: callerRole } = await supabaseAdmin.from("usuarios").select("role").eq("id", caller.id).single();
    if (!callerRole || callerRole.role !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem criar usuários" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { email, password, role, funcionario_id } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update the usuario record (created by trigger) with role and funcionario
    if (newUser.user) {
      const userRole = role || "garcom";
      await supabaseAdmin.from("usuarios").update({
        role: userRole,
        funcionario_id: funcionario_id || null,
      }).eq("id", newUser.user.id);

      // Set default permissions based on role
      const allModulos = [
        'dashboard_mesa', 'dashboard_delivery', 'caixa',
        'mesas', 'clientes', 'produtos', 'categorias',
        'comandas', 'entregas', 'inventario', 'relatorios', 'relatorio_caixa',
        'funcionarios', 'usuarios', 'configuracoes',
      ];
      const allowedForNonAdmin = new Set([
        'dashboard_mesa', 'dashboard_delivery', 'caixa',
        'mesas', 'clientes', 'produtos', 'categorias',
        'configuracoes',
      ]);
      const perms = allModulos.map(modulo => ({
        usuario_id: newUser.user!.id,
        modulo,
        pode_visualizar: userRole === 'admin' || allowedForNonAdmin.has(modulo),
        pode_criar: userRole === 'admin' || allowedForNonAdmin.has(modulo),
        pode_editar: userRole === 'admin' || allowedForNonAdmin.has(modulo),
        pode_excluir: userRole === 'admin' || allowedForNonAdmin.has(modulo),
      }));
      await supabaseAdmin.from("permissoes_usuario").insert(perms);
    }

    return new Response(JSON.stringify({ success: true, user_id: newUser.user?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
