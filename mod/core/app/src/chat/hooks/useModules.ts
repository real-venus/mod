"use client";

import { useEffect } from 'react'
import type { Module, ModuleSchema, Client } from '../types'
import { sortModules } from '../utils'

interface UseModulesProps {
  client: Client | null
  selectedModules: Module[]
  setAllModules: (modules: Module[]) => void
  setSelectedModules: (modules: Module[]) => void
  setParams: (params: Record<string, any>) => void
  setDefaultParams: (params: Record<string, any>) => void
  selectedFunction: string
  searchQuery?: string
}

/**
 * Hook to load and manage modules
 * Fetches all modules, handles schema loading for selected modules
 */
export function useModules({
  client,
  selectedModules,
  setAllModules,
  setSelectedModules,
  setParams,
  setDefaultParams,
  selectedFunction,
  searchQuery = ''
}: UseModulesProps) {

  // Load all modules on mount and when search query changes
  useEffect(() => {
    const loadModules = async () => {
      if (!client) return

      try {
        const mods = await client.call('mods', { search: searchQuery })
        const sortedModules = Array.isArray(mods) ? sortModules(mods) : []
        setAllModules(sortedModules)
      } catch (err) {
        console.error('Failed to load modules:', err)
        setAllModules([])
      }
    }

    loadModules()
  }, [client, searchQuery])

  // Load schemas for selected modules
  useEffect(() => {
    const loadSchemas = async () => {
      if (!client || selectedModules.length === 0) return

      try {
        // Load schema for each selected module that doesn't have one
        const modulesNeedingSchema = selectedModules.filter(
          m => !m.schema || typeof m.schema === 'string'
        )

        for (const module of modulesNeedingSchema) {
          try {
            const modData = await client.call('mod', {
              name: module.name,
              key: module.key
            })

            if (modData?.schema) {
              // Parse schema if it's a string
              const parsedSchema =
                typeof modData.schema === 'string'
                  ? JSON.parse(modData.schema)
                  : modData.schema

              // Update the module with its schema
              setSelectedModules(
                selectedModules.map(m =>
                  m.name === module.name && m.key === module.key
                    ? { ...m, schema: parsedSchema }
                    : m
                )
              )
            }
          } catch (err) {
            console.error(`Failed to load schema for ${module.name}:`, err)
          }
        }
      } catch (err) {
        console.error('Failed to load schemas:', err)
      }
    }

    loadSchemas()
  }, [client, selectedModules.map(m => m.name).join(',')])

  // Update params when function changes
  useEffect(() => {
    if (!selectedFunction) return

    // Find the schema for the selected function from any selected module
    let functionSchema: any = null
    for (const module of selectedModules) {
      if (module.schema && typeof module.schema === 'object') {
        const schema = module.schema as ModuleSchema
        if (schema[selectedFunction]) {
          functionSchema = schema[selectedFunction]
          break
        }
      }
    }

    if (functionSchema?.input) {
      const newParams: Record<string, any> = {}
      Object.entries(functionSchema.input).forEach(([key, param]: [string, any]) => {
        if (key !== 'self' && key !== 'cls') {
          newParams[key] = param.value ?? ''
        }
      })
      setParams(newParams)
      setDefaultParams(newParams)
    }
  }, [selectedFunction, selectedModules])
}
