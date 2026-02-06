'use client'

import { useEffect } from 'react'

export function useChatEffects({
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
}: {
  client: any
  modules: any[]
  selectedModule: string
  selectedFunction: string
  schema: any
  input: string
  selectedInputParam: string
  setModules: (mods: any[]) => void
  setFunctions: (fns: string[]) => void
  setSchema: (schema: any) => void
  setDefaultParams: (params: Record<string, any>) => void
  setParams: (params: any) => void
  setSelectedInputParam: (param: string) => void
}) {
  
  useEffect(() => {
    const fetchModules = async () => {
      if (!client) return
      try {
        const mods = await client.call('mods', {})
        const sortedMods = Array.isArray(mods) ? mods.sort((a: any, b: any) => a.name.localeCompare(b.name)) : []
        setModules(sortedMods)
      } catch (err: unknown) {
        console.error('Failed to fetch modules:', err)
      }
    }
    fetchModules()
  }, [client])

  useEffect(() => {
    if (!selectedModule || !client) {
      setFunctions([])
      return
    }
    const mod = modules.find((m: any) => m.name === selectedModule)
    if (mod?.schema) {
      if (typeof mod.schema === 'string'){
        const promise = client.call('get', { cid: mod.schema })
        promise.then((fetchedSchema: any) => {
          const fnNames = Object.keys(fetchedSchema).filter((fn: string) => fn !== 'self' && fn !== 'cls').sort()
          setFunctions(fnNames)
          setSchema(fetchedSchema)
        }).catch((err: unknown) => {
          console.error('Failed to fetch module schema:', err)
        })    
      }
    }
  }, [selectedModule, modules, client])

  useEffect(() => {
    if (selectedFunction && schema && schema[selectedFunction]) {
      const functionSchema = schema[selectedFunction]
      const defaultParams: Record<string, any> = {}
      const inputKeys = Object.keys(functionSchema.input || {}).filter((k: string) => k !== 'self' && k !== 'cls')
      
      if (functionSchema.input) {
        Object.entries(functionSchema.input).forEach(([key, value]: [string, any]) => {
          if (value.value !== '_empty' && value.value !== undefined) {
            defaultParams[key] = value.value
          }
        })
      }
      
      const hasKwargs = inputKeys.some((k: string) => k === 'kwargs')
      if (hasKwargs) {
        Object.entries(functionSchema.input).forEach(([key, value]: [string, any]) => {
          if (key !== 'self' && key !== 'cls' && key !== 'kwargs' && !(key in defaultParams)) {
            defaultParams[key] = value.value !== '_empty' ? value.value : ''
          }
        })
      }
      
      setDefaultParams(defaultParams)
      setParams(defaultParams)
      
      if (inputKeys.length > 0) {
        setSelectedInputParam(inputKeys[0])
      } else {
        setSelectedInputParam('')
      }
    } else {
      setParams({})
      setDefaultParams({})
      setSelectedInputParam('')
    }
  }, [selectedFunction, schema, selectedModule])

  useEffect(() => {
    if (!input && selectedInputParam) {
      setParams((prev: Record<string, any>) => {
        const newParams = { ...prev }
        if (schema && schema[selectedFunction] && schema[selectedFunction].input[selectedInputParam]) {
          const defaultValue = schema[selectedFunction].input[selectedInputParam].value
          if (defaultValue !== '_empty' && defaultValue !== undefined) {
            newParams[selectedInputParam] = defaultValue
          }
        }
        return newParams
      })
    } else if (input && selectedInputParam) {
      setParams((prev: Record<string, any>) => ({ ...prev, [selectedInputParam]: input }))
    }
  }, [input, selectedInputParam])
}
