"use client"

import React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset className="min-w-0 max-w-full overflow-x-hidden">
        <AppHeader />
        <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 min-w-0">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
