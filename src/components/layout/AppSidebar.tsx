import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  Users,
  ChefHat,
  Truck,
  CreditCard,
  Settings,
  Grid3X3,
  UserCog,
  ShieldCheck,
  Tag,
  Package,
  BarChart3,
  Landmark,
  Warehouse,
  Building2,
  Trophy,
  ShoppingBag } from
'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useEmpresa } from '@/hooks/useEmpresa';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar } from
'@/components/ui/sidebar';

const mainItems = [
{ title: 'Dashboard Mesa', url: '/', icon: Grid3X3 },
{ title: 'Dashboard Delivery', url: '/dashboard-delivery', icon: Truck },
{ title: 'Caixa', url: '/caixa', icon: Landmark },
];

const cadastroItems = [
{ title: 'Mesas', url: '/mesas', icon: Grid3X3 },
{ title: 'Clientes', url: '/clientes', icon: Users },
{ title: 'Produtos', url: '/produtos', icon: Package },
{ title: 'Categorias', url: '/categorias', icon: Tag },
];

const managementItems = [
{ title: 'Comandas', url: '/comandas', icon: ClipboardList },
{ title: 'Entregas', url: '/entregas', icon: Truck },
{ title: 'Inventário', url: '/inventario', icon: Warehouse },
{ title: 'Relatórios', url: '/relatorios', icon: BarChart3, adminOnly: true },
{ title: 'Rel. Caixa', url: '/relatorio-caixa', icon: Landmark, adminOnly: true },
{ title: 'Vendas por Produto', url: '/vendas-cronologico', icon: ClipboardList, adminOnly: true },
{ title: 'Vendas do Dia', url: '/vendas-do-dia', icon: ShoppingBag, adminOnly: true },
{ title: 'Clientes do Dia', url: '/clientes-do-dia', icon: Users, adminOnly: true },
{ title: 'Ranking Clientes', url: '/ranking-clientes', icon: Trophy, adminOnly: true }];

const adminItems = [
{ title: 'Funcionários', url: '/funcionarios', icon: UserCog },
{ title: 'Usuários', url: '/usuarios', icon: ShieldCheck },
{ title: 'Configurações', url: '/configuracoes', icon: Settings }];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { empresa } = useEmpresa();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const isActive = (path: string) =>
  path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const renderGroup = (label: string, items: typeof managementItems) => {
    const filtered = items.filter((item) => !('adminOnly' in item && item.adminOnly) || isAdmin);
    if (filtered.length === 0) return null;
    return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {filtered.map((item) =>
        <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <NavLink
              to={item.url}
              end={item.url === '/'}
              className="hover:bg-sidebar-accent/50"
              activeClassName="bg-primary/10 text-primary font-medium">
              
                  <item.icon className="mr-2 h-4 w-4" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
        )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 flex items-center gap-3">
          {empresa?.logo_url ? (
            <img src={empresa.logo_url} alt="Logo" className="h-8 w-8 rounded-md object-cover flex-shrink-0" />
          ) : (
            <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 border border-border">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          {!collapsed &&
          <div>
              <h2 className="font-serif text-sm font-semibold text-foreground leading-tight">{empresa?.nome || 'Akarusa'}</h2>
              <p className="text-[10px] text-muted-foreground">Gestão</p>
            </div>
          }
        </div>

        {renderGroup('Principal', mainItems)}
        {renderGroup('Cadastros', cadastroItems)}
        {renderGroup('Gestão', managementItems)}
        {renderGroup('Administração', adminItems)}
      </SidebarContent>
    </Sidebar>);
}
