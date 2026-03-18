'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  Eye,
  GitCompareArrows,
  BarChart3,
  PanelLeft,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  {
    title: 'Projects',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'New Analysis',
    href: '/dashboard/new',
    icon: Upload,
  },
  {
    title: 'Compare',
    href: '/compare',
    icon: GitCompareArrows,
  },
  {
    title: 'Vision',
    href: '/vision',
    icon: Eye,
  },
  {
    title: 'Portfolio',
    href: '/instruments',
    icon: BarChart3,
  },
];

function SidebarWordmark() {
  const { state } = useSidebar();

  return (
    <Link
      href="/dashboard"
      className={`flex items-center group transition-all ${
        state === 'collapsed' ? 'justify-center px-0' : 'gap-2.5 px-1'
      }`}
    >
      {/* Emerald logomark */}
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-[11px] font-bold tracking-tight shrink-0 group-hover:opacity-90 transition-opacity">
        LF
      </div>
      {state === 'expanded' && (
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
          Lendflow
        </span>
      )}
    </Link>
  );
}

function SidebarToggleButton() {
  const { toggleSidebar } = useSidebar();

  return (
    <SidebarMenuButton
      className="w-full cursor-pointer"
      tooltip="Toggle sidebar"
      onClick={toggleSidebar}
    >
      <PanelLeft className="h-4 w-4" />
      <span>Collapse</span>
    </SidebarMenuButton>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const handleSidebarClick = (e: React.MouseEvent) => {
    if (isCollapsed) {
      e.preventDefault();
      toggleSidebar();
    }
  };

  return (
    <Sidebar
      collapsible="icon"
      onClick={handleSidebarClick}
      className={isCollapsed ? 'cursor-pointer' : ''}
    >
      <SidebarHeader className={`py-4 ${isCollapsed ? 'px-0' : 'px-3'}`}>
        <SidebarWordmark />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.href === '/dashboard'
                        ? pathname === '/dashboard'
                        : pathname.startsWith(item.href)
                    }
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarToggleButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
