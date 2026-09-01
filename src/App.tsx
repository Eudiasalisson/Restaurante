import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import DashboardMesa from "./pages/DashboardMesa";
import DashboardDelivery from "./pages/DashboardDelivery";
import Mesas from "./pages/Mesas";

import Comandas from "./pages/Comandas";

import Clientes from "./pages/Clientes";
import Entregas from "./pages/Entregas";
import Pagamentos from "./pages/Pagamentos";
import Configuracoes from "./pages/Configuracoes";
import ComandaDetalhe from "./pages/ComandaDetalhe";
import EntregaDetalhe from "./pages/EntregaDetalhe";
import Funcionarios from "./pages/Funcionarios";
import FuncionarioDetalhe from "./pages/FuncionarioDetalhe";
import Usuarios from "./pages/Usuarios";
import Categorias from "./pages/Categorias";
import Produtos from "./pages/Produtos";
import Relatorios from "./pages/Relatorios";
import RelatorioCaixa from "./pages/RelatorioCaixa";
import ProdutosVendidosDia from "./pages/ProdutosVendidosDia";
import VendasCronologico from "./pages/VendasCronologico";
import VendasDoDia from "./pages/VendasDoDia";
import CaixaPage from "./pages/Caixa";
import Inventario from "./pages/Inventario";
import Cardapio from "./pages/Cardapio";
import ClientesDoDia from "./pages/ClientesDoDia";
import RankingClientes from "./pages/RankingClientes";
import Sorteio from "./pages/Sorteio";
import NotasFiscais from "./pages/NotasFiscais";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (profile && profile.role !== 'admin') return <Navigate to="/" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><DashboardMesa /></ProtectedRoute>} />
      <Route path="/dashboard-delivery" element={<ProtectedRoute><DashboardDelivery /></ProtectedRoute>} />
      <Route path="/mesas" element={<ProtectedRoute><Mesas /></ProtectedRoute>} />
      
      <Route path="/comandas" element={<ProtectedRoute><Comandas /></ProtectedRoute>} />
      <Route path="/comanda/:id" element={<ProtectedRoute><ComandaDetalhe /></ProtectedRoute>} />
      
      <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
      <Route path="/entregas" element={<ProtectedRoute><Entregas /></ProtectedRoute>} />
      <Route path="/entrega/:id" element={<ProtectedRoute><EntregaDetalhe /></ProtectedRoute>} />
      <Route path="/pagamentos" element={<ProtectedRoute><Pagamentos /></ProtectedRoute>} />
      <Route path="/funcionarios" element={<ProtectedRoute><Funcionarios /></ProtectedRoute>} />
      <Route path="/funcionario/:id" element={<ProtectedRoute><FuncionarioDetalhe /></ProtectedRoute>} />
      <Route path="/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
      <Route path="/categorias" element={<ProtectedRoute><Categorias /></ProtectedRoute>} />
      <Route path="/produtos" element={<ProtectedRoute><Produtos /></ProtectedRoute>} />
      <Route path="/relatorios" element={<AdminRoute><Relatorios /></AdminRoute>} />
      <Route path="/relatorio-caixa" element={<AdminRoute><RelatorioCaixa /></AdminRoute>} />
      <Route path="/produtos-vendidos" element={<AdminRoute><ProdutosVendidosDia /></AdminRoute>} />
      <Route path="/vendas-cronologico" element={<AdminRoute><VendasCronologico /></AdminRoute>} />
      <Route path="/vendas-do-dia" element={<AdminRoute><VendasDoDia /></AdminRoute>} />
      <Route path="/clientes-do-dia" element={<ProtectedRoute><ClientesDoDia /></ProtectedRoute>} />
      <Route path="/ranking-clientes" element={<AdminRoute><RankingClientes /></AdminRoute>} />
      <Route path="/sorteio" element={<AdminRoute><Sorteio /></AdminRoute>} />
      <Route path="/notas-fiscais" element={<AdminRoute><NotasFiscais /></AdminRoute>} />
      <Route path="/caixa" element={<ProtectedRoute><CaixaPage /></ProtectedRoute>} />
      <Route path="/inventario" element={<ProtectedRoute><Inventario /></ProtectedRoute>} />
      <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
      <Route path="/cardapio" element={<Cardapio />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
