"use client";

import UnifiedInterface from '../components/UnifiedInterface'
import { useState, useEffect } from 'react'

/**
 * Example usage of the UnifiedInterface component
 *
 * This component demonstrates how to integrate the unified interface
 * into your application with API, App, and Code tabs.
 */
export default function UnifiedInterfaceExample() {
  const [client, setClient] = useState<any>(null)

  useEffect(() => {
    // Initialize your API client here
    // For example, using the mod client:
    // import { createClient } from '@/lib/client'
    // const apiClient = createClient({ baseUrl: 'https://api.example.com' })
    // setClient(apiClient)
  }, [])

  // Example module data
  const exampleModule = {
    name: 'claude',
    key: 'broski',

    // API Schema - defines available functions
    schema: {
      generate: {
        input: {
          prompt: { type: 'string', value: '' },
          max_tokens: { type: 'number', value: 100 },
          stream: { type: 'bool', value: false }
        },
        output: { type: 'string' }
      },
      analyze: {
        input: {
          text: { type: 'string', value: '' },
          detailed: { type: 'bool', value: true }
        },
        output: { type: 'object' }
      },
      search: {
        input: {
          query: { type: 'string', value: '' },
          limit: { type: 'number', value: 10 }
        },
        output: { type: 'array' }
      }
    },

    // App URL - iframe will load this
    url_app: 'https://claude.ai',

    // Content - file tree with CIDs
    content: {
      'README.md': 'QmExampleCID1',
      'src/main.py': 'QmExampleCID2',
      'src/utils.py': 'QmExampleCID3',
      'src/api/handlers.py': 'QmExampleCID4',
      'src/api/__init__.py': 'QmExampleCID5',
      'tests/test_main.py': 'QmExampleCID6',
      'package.json': 'QmExampleCID7',
      'tsconfig.json': 'QmExampleCID8',
    }
  }

  return (
    <div
      className="min-h-screen p-8"
      style={{
        backgroundColor: 'var(--bg-primary)',
        fontFamily: 'var(--font-digital), monospace'
      }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold uppercase tracking-wider mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            ▸ Unified Interface Demo
          </h1>
          <p
            className="text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            A comprehensive interface combining API, App, and Code views
          </p>
        </div>

        {/* Unified Interface */}
        <UnifiedInterface
          mod={exampleModule}
          client={client}
          defaultTab="api"
        />

        {/* Documentation */}
        <div
          className="mt-8 p-6 border-4"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-strong)'
          }}
        >
          <h2
            className="text-lg font-bold uppercase tracking-wider mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            ▸ Features
          </h2>
          <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <li>• <strong>API Tab:</strong> Interactive function browser with parameter inputs and execution</li>
            <li>• <strong>App Tab:</strong> Embedded iframe preview with external link option</li>
            <li>• <strong>Code Tab:</strong> File tree navigation with syntax-aware code viewer</li>
            <li>• <strong>Smart Display:</strong> Only shows tabs for available data (API/App/Code)</li>
            <li>• <strong>Search:</strong> Search functions in API tab, files in Code tab</li>
            <li>• <strong>Copy:</strong> Copy results, code, and outputs with one click</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
