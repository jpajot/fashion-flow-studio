import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Shirt,
  Palette,
  Layers,
  FolderKanban,
  Factory,
  FileText,
  GitBranch,
  Beaker,
  DollarSign,
  Users,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Style Library", url: "/styles", icon: Shirt },
  { title: "Materials", url: "/materials", icon: Layers },
  { title: "Colorways", url: "/colorways", icon: Palette },
  { title: "BOMs", url: "/boms", icon: FileText },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Suppliers", url: "/suppliers", icon: Factory },
  { title: "RFQs", url: "/rfqs", icon: DollarSign },
  { title: "ECOs", url: "/ecos", icon: GitBranch },
  { title: "Samples", url: "/samples", icon: Beaker },
  { title: "Team", url: "/team", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const isActive = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="bg-sidebar">
        <div className="px-4 py-5 border-b border-sidebar-border">
          <h1 className="text-sidebar-foreground font-semibold text-lg tracking-tight">
            Intimity<span className="text-sidebar-primary">Flow</span>
          </h1>
          <p className="text-xs text-sidebar-foreground/60 mt-0.5">PLM</p>
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
