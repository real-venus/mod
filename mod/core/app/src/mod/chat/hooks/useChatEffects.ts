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
}: any) {
  
  useEffect(() => {
    const fetchModules = async () => {
      if (!client) return
      try {
        const mods = await client.call('mods', {})
        const sortedMods = Array.isArray(mods) ? mods.sort((a, b) => a.name.localeCompare(b.name)) : []
        setModules(sortedMods)
      } catch (err) {
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
    const mod = modules.find(m => m.name === selectedModule)
    if (mod?.schema) {
      if (typeof mod.schema === 'string'){
        let promise = client.call('get', { cid: mod.schema })
        promise.then((schema) => {
          const fnNames = Object.keys(schema).filter((fn: string) => fn !== 'self' && fn !== 'cls').sort()
          setFunctions(fnNames)
          setSchema(schema)
        }).catch((err) => {
          console.error('Failed to fetch module schema:', err)
        })    
      }
    }
  }, [selectedModule, modules, client])

  useEffect(() => {
    if (selectedFunction && schema && schema[selectedFunction]) {
      const functionSchema = schema[selectedFunction]
      const defaultParams: Record<string, any> = {}
      const inputKeys = Object.keys(functionSchema.input || {}).filter(k => k !== 'self' && k !== 'cls')
      
      if (functionSchema.input) {
        Object.entries(functionSchema.input).forEach(([key, value]: [string, any]) => {
          if (value.value !== '_empty' && value.value !== undefined) {
            defaultParams[key] = value.value
          }
        })
      }
      
      // CHECK FOR KWARGS AND ADD MISSING PARAMS
      const hasKwargs = inputKeys.some(k => k === 'kwargs')
      if (hasKwargs) {
        // Get all possible params from schema that aren't already in defaultParams
        Object.entries(functionSchema.input).forEach(([key, value]: [string, any]) => {
          if (key !== 'self' && key !== 'cls' && key !== 'kwargs' && !(key in defaultParams)) {
            // Add param with empty value if not specified
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
      setParams(prev => {
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
      setParams(prev => ({ ...prev, [selectedInputParam]: input }))
    }
  }, [input, selectedInputParam])
}