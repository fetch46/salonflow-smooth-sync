import { useCallback, useEffect, useMemo, useState } from "react"
import { useSaas } from "@/lib/saas"

export type NotificationItem = {
  id: string
  title: string
  description?: string
  read: boolean
  createdAt: number
}

function makeStorageKey(userId?: string | null, orgId?: string | null) {
  return `notifications:${userId || "anon"}:${orgId || "global"}`
}

function loadFromStorage(key: string): NotificationItem[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray(parsed.items)) return parsed.items
    return []
  } catch {
    return []
  }
}

function saveToStorage(key: string, items: NotificationItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch {}
}

export function useNotifications() {
  const { user, organization } = useSaas()
  const storageKey = useMemo(
    () => makeStorageKey(user?.id || null, organization?.id || null),
    [user?.id, organization?.id]
  )

  const [items, setItems] = useState<NotificationItem[]>([])

  useEffect(() => {
    setItems(loadFromStorage(storageKey))
  }, [storageKey])

  const markAllAsRead = useCallback(() => {
    setItems((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }))
      saveToStorage(storageKey, next)
      return next
    })
  }, [storageKey])

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (organization?.id) params.set("orgId", organization.id)
      const res = await fetch(`/api/notifications/feed?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch notifications")
      const data = await res.json()
      const fetched: Array<Omit<NotificationItem, "read">> = (data?.items || []).map(
        (it: any) => ({
          id: String(it.id),
          title: String(it.title || ""),
          description: it.description ? String(it.description) : undefined,
          createdAt:
            typeof it.createdAt === "number"
              ? it.createdAt
              : it.created_at
              ? Date.parse(it.created_at)
              : Date.now(),
        })
      )

      setItems((prev) => {
        const prevReadById = new Map(prev.map((p) => [p.id, p.read] as const))
        const merged: NotificationItem[] = fetched.map((f) => ({
          ...f,
          read: prevReadById.get(f.id) ?? false,
        }))
        merged.sort((a, b) => b.createdAt - a.createdAt)
        saveToStorage(storageKey, merged)
        return merged
      })
    } catch {
      // ignore and keep existing local state
    }
  }, [organization?.id, storageKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const id = setInterval(() => void refresh(), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [refresh])

  const unreadNotifications = useMemo(
    () => items.filter((n) => !n.read).sort((a, b) => b.createdAt - a.createdAt),
    [items]
  )

  return {
    notifications: items,
    unreadNotifications,
    unreadCount: unreadNotifications.length,
    markAllAsRead,
    refresh,
  }
}