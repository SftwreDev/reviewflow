"use client"

import * as React from "react"
import Link from "next/link"
import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { LayoutDashboardIcon, GitPullRequest, Settings2Icon, CommandIcon, Sparkles } from "lucide-react"
import { useApp } from "@/lib/app-context"

const data = {
  user: { name: "ReviewFlow", email: "Local workspace", avatar: "/avatars/shadcn.jpg" },
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: <LayoutDashboardIcon className="size-4" />,
      tab: "dashboard" as const,
    },
    {
      title: "Pull Requests",
      url: "/?tab=pulls",
      icon: <GitPullRequest className="size-4" />,
      tab: "pulls" as const,
    },
    {
      title: "Skills",
      url: "/?tab=skills",
      icon: <Sparkles className="size-4" />,
      tab: "skills" as const,
    },
    {
      title: "Settings",
      url: "/?tab=settings",
      icon: <Settings2Icon className="size-4" />,
      tab: "settings" as const,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  let app: ReturnType<typeof useApp> | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    app = useApp()
  } catch {
    // Fallback
  }

  const handleLogoClick = (e: React.MouseEvent) => {
    if (app) {
      e.preventDefault()
      app.closePr()
      app.setActiveTab("dashboard")
    }
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link href="/" onClick={handleLogoClick}>
                  <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <CommandIcon className="size-3.5" />
                  </div>
                  <span className="text-sm font-semibold tracking-tight">ReviewFlow</span>
                </Link>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground">
          <span>{data.user.email}</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
