"use client"

import React from "react"
import Link from "next/link"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useApp, type TabType } from "@/lib/app-context"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
    tab?: TabType
  }[]
}) {
  let app: ReturnType<typeof useApp> | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    app = useApp()
  } catch {
    // Graceful fallback if rendered outside AppProvider
  }

  const handleClick = (e: React.MouseEvent, tab?: TabType) => {
    if (app && tab) {
      e.preventDefault()
      app.setActiveTab(tab)
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            const isActive = app?.activeTab === item.tab && app?.activePrId === null

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={Boolean(isActive)}
                  render={
                    <Link
                      href={item.url}
                      onClick={(e) => handleClick(e, item.tab)}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
