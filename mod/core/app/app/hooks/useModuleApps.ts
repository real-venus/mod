"use client"

import { useState, useEffect } from 'react'
import { userContext } from '@/context'

export interface ModuleApp {
  url: string
  owner: string
}

/**
 * Hook that fetches the app namespace (running module app servers)
 * and refreshes periodically for auto-discovery.
 * Returns {name: {url, owner}} for each running module app.
 */
export function useModuleApps(): Record<string, ModuleApp> {
  const { client } = userContext()
  const [moduleApps, setModuleApps] = useState<Record<string, ModuleApp>>({})

  useEffect(() => {
    if (!client) return

    const fetchApps = async () => {
      try {
        const result = await client.call('app_namespace')
        if (result && typeof result === 'object') {
          // Normalize: support both {name: {url, owner}} and legacy {name: url_string}
          const normalized: Record<string, ModuleApp> = {}
          for (const [key, val] of Object.entries(result)) {
            if (typeof val === 'string') {
              normalized[key] = { url: val, owner: '' }
            } else if (val && typeof val === 'object') {
              normalized[key] = val as ModuleApp
            }
          }
          setModuleApps(normalized)
        }
      } catch {
        // API not available
      }
    }

    fetchApps()
    const interval = setInterval(fetchApps, 10000)
    return () => clearInterval(interval)
  }, [client])

  return moduleApps
}
