"use client";

import { useEffect } from 'react'
import type { ChatState, Module, ModuleSchema } from '../types'
import { sortModules, extractFunctions, getInputParams, extractDefaultParams, isEmptyValue } from '../utils'

interface UseChatEffectsParams {
  client: ChatState['client']
  modules: Module[]
  selectedModule: string
  selectedFunction: string
  schema: ModuleSchema | null
  input: string
  selectedInputParam: string
  setModules: (mods: Module[]) => void
  setFunctions: (fns: string[]) => void
  setSchema: (schema: ModuleSchema | null) => void
  setDefaultParams: (params: Record<string, any>) => void
  setParams: (params: any) => void
  setSelectedInputParam: (param: string) => void
}

/**
 * Custom hook to handle side effects for chat state
 * Manages data fetching, schema parsing, and parameter synchronization
 *
 * @param params - Object containing chat state and setters
 */
export function useChatEffects(params: UseChatEffectsParams): void {
  const {
    client,
    modules,
    selectedModule,
    selectedFunction,
    schema,
    input,
    selectedInputParam,
    setModules,
    setFunctions,
    setSchema,
    setDefaultParams,
    setParams,
    setSelectedInputParam
  } = params

  /**
   * Effect: Fetch modules on mount
   */
  useEffect(() => {
    const fetchModules = async () => {
      if (!client) return

      try {
        const mods = await client.call<Module[]>('mods', {})
        const sortedMods = Array.isArray(mods) ? sortModules(mods) : []
        setModules(sortedMods)
      } catch (err: unknown) {
        console.error('Failed to fetch modules:', err)
        setModules([])
      }
    }

    fetchModules()
  }, [client, setModules])

  /**
   * Effect: Fetch schema and functions when module changes
   */
  useEffect(() => {
    if (!selectedModule || !client) {
      setFunctions([])
      return
    }

    const mod = modules.find((m) => m.name === selectedModule)
    if (!mod?.schema) {
      setFunctions([])
      return
    }

    // If schema is a string (CID), fetch it
    if (typeof mod.schema === 'string') {
      const fetchSchema = async () => {
        try {
          const fetchedSchema = await client.call<ModuleSchema>('get', { cid: mod.schema })
          const fnNames = extractFunctions(fetchedSchema)
          setFunctions(fnNames)
          setSchema(fetchedSchema)
        } catch (err: unknown) {
          console.error('Failed to fetch module schema:', err)
          setFunctions([])
          setSchema(null)
        }
      }

      fetchSchema()
    } else {
      // Schema is already an object
      const fnNames = extractFunctions(mod.schema)
      setFunctions(fnNames)
      setSchema(mod.schema)
    }
  }, [selectedModule, modules, client, setFunctions, setSchema])

  /**
   * Effect: Update parameters when function changes
   */
  useEffect(() => {
    if (!selectedFunction || !schema || !schema[selectedFunction]) {
      setParams({})
      setDefaultParams({})
      setSelectedInputParam('')
      return
    }

    const functionSchema = schema[selectedFunction]
    const defaultParams = extractDefaultParams(functionSchema)

    setDefaultParams(defaultParams)
    setParams(defaultParams)

    // Set first input parameter as selected
    const inputKeys = getInputParams(functionSchema.input || {})
    if (inputKeys.length > 0) {
      setSelectedInputParam(inputKeys[0])
    } else {
      setSelectedInputParam('')
    }
  }, [selectedFunction, schema, selectedModule, setDefaultParams, setParams, setSelectedInputParam])

  /**
   * Effect: Sync input with selected parameter
   */
  useEffect(() => {
    if (!selectedInputParam || !schema || !selectedFunction) {
      return
    }

    const functionSchema = schema[selectedFunction]
    if (!functionSchema?.input?.[selectedInputParam]) {
      return
    }

    // Update params based on input value
    if (!input) {
      // If input is empty, restore default value
      setParams((prev: Record<string, any>) => {
        const newParams = { ...prev }
        const defaultValue = functionSchema.input[selectedInputParam].value

        if (!isEmptyValue(defaultValue)) {
          newParams[selectedInputParam] = defaultValue
        }

        return newParams
      })
    } else {
      // Sync input to params
      setParams((prev: Record<string, any>) => ({
        ...prev,
        [selectedInputParam]: input
      }))
    }
  }, [input, selectedInputParam, schema, selectedFunction, setParams])
}
