'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignOutButton } from '@clerk/nextjs';
import {
  LayoutDashboard,
  Upload,
  LogOut,
  Eye,
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
    title: 'Vision',
    href: '/vision',
    icon: Eye,
  },
];

function SidebarWordmark() {
  const { state } = useSidebar();

  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold shrink-0">
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

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
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
            <SignOutButton>
              <SidebarMenuButton
                className="w-full cursor-pointer"
                tooltip="Sign out"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SignOutButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
