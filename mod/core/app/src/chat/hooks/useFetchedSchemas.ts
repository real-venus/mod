"use client";

import { useState, useEffect, useRef } from 'react'
import type { Client, Module, ModuleSchema } from '../types'

interface UseFetchedSchemasProps {
  selectedModules: Module[]
  client: Client | null
}

/**
 * Hook to fetch and cache module schemas from CIDs
 * Returns a map of all schemas (both direct and fetched)
 */
export function useFetchedSchemas({ selectedModules, client }: UseFetchedSchemasProps) {
  const [fetchedSchemas, setFetchedSchemas] = useState<Map<string, ModuleSchema>>(new Map())
  const fetchingCids = useRef<Set<string>>(new Set())

  // Fetch schemas when modules change
  useEffect(() => {
    if (!client) return

    const schemasToFetch = selectedModules.filter(
      module => module.schema && typeof module.schema === 'string'
    )

    if (schemasToFetch.length === 0) return

    schemasToFetch.forEach(async (module) => {
      const cid = module.schema as string

      // Skip if already fetched or currently fetching
      if (fetchingCids.current.has(cid)) return

      // Mark as being fetched
      fetchingCids.current.add(cid)

      try {
        const schema = await client.call('get', { cid })
        console.log(`Fetched schema for ${module.name}:`, schema)

        setFetchedSchemas(prev => new Map(prev).set(cid, schema))
      } catch (err) {
        console.error(`Failed to fetch schema for ${module.name} with CID ${cid}:`, err)
        // Remove from fetchingCids on error so it can be retried
        fetchingCids.current.delete(cid)
      }
    })
  }, [selectedModules, client])

  // Build combined schema map from all selected modules
  const getCombinedSchema = (): ModuleSchema => {
    const schema: ModuleSchema = {}

    selectedModules.forEach(module => {
      if (!module.schema) return

      let moduleSchema: ModuleSchema

      // Get schema - either from fetched schemas or directly
      if (typeof module.schema === 'string') {
        const fetchedSchema = fetchedSchemas.get(module.schema)
        if (!fetchedSchema) return // Still fetching
        moduleSchema = fetchedSchema
      } else {
        moduleSchema = module.schema
      }

      // Merge into combined schema
      Object.assign(schema, moduleSchema)
    })

    return schema
  }

  return {
    fetchedSchemas,
    combinedSchema: getCombinedSchema()
  }
}
