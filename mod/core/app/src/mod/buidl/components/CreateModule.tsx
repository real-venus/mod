"use client";

import { useState } from 'react'
import { userContext } from '@/mod/context/UserContext'
import { text2color } from '@/mod/utils'
import { motion } from 'framer-motion'
import { SparklesIcon, CodeBracketIcon, TagIcon, DocumentTextIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'

export default function CreateModule() {
  const { user } = userContext()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [code, setCode] = useState('')
  const [tags, setTags] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const userColor = user?.key ? text2color(user.key) : '#a855f7'

  const handleSubmit = async () => {
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      // TODO: Implement module creation API call
      console.log('Creating module:', { name, description, code, tags })
      await new Promise(resolve => setTimeout(resolve, 1500))
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputStyle = (fieldName: string) => ({
    borderColor: focusedField === fieldName ? userColor : 'rgba(255,255,255,0.08)',
    backgroundColor: focusedField === fieldName ? `${userColor}05` : 'rgba(255,255,255,0.02)',
    boxShadow: focusedField === fieldName ? `0 0 20px ${userColor}10` : 'none',
  })

  const fields = [
    { name: 'name', label: 'Module Name', icon: SparklesIcon, placeholder: 'my-awesome-module', value: name, onChange: setName, type: 'input' },
    { name: 'description', label: 'Description', icon: DocumentTextIcon, placeholder: 'What does this module do?', value: description, onChange: setDescription, type: 'textarea', rows: 3 },
    { name: 'code', label: 'Code', icon: CodeBracketIcon, placeholder: '# Write your module code here...\ndef forward(self, x):\n    return x', value: code, onChange: setCode, type: 'code', rows: 12 },
    { name: 'tags', label: 'Tags', icon: TagIcon, placeholder: 'ai, ml, utility (comma separated)', value: tags, onChange: setTags, type: 'input' },
  ]

  return (
    <div className="space-y-5">
      {fields.map((field, index) => (
        <motion.div
          key={field.name}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.08 }}
        >
          <label className="flex items-center gap-2 mb-2">
            <field.icon className="w-4 h-4" style={{ color: userColor }} />
            <span 
              className="text-sm font-bold uppercase tracking-wider"
              style={{ color: `${userColor}90`, fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
            >
              {field.label}
            </span>
          </label>
          {field.type === 'input' ? (
            <input
              type="text"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              onFocus={() => setFocusedField(field.name)}
              onBlur={() => setFocusedField(null)}
              placeholder={field.placeholder}
              className="w-full px-4 py-3 rounded-xl border-2 bg-transparent text-white placeholder-gray-600 outline-none transition-all duration-300 font-mono text-sm"
              style={inputStyle(field.name)}
            />
          ) : field.type === 'code' ? (
            <textarea
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              onFocus={() => setFocusedField(field.name)}
              onBlur={() => setFocusedField(null)}
              placeholder={field.placeholder}
              rows={field.rows}
              className="w-full px-4 py-3 rounded-xl border-2 bg-transparent text-green-400 placeholder-gray-700 outline-none transition-all duration-300 font-mono text-sm resize-none leading-relaxed"
              style={{
                ...inputStyle(field.name),
                fontFamily: 'IBM Plex Mono, Courier New, monospace',
              }}
              spellCheck={false}
            />
          ) : (
            <textarea
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              onFocus={() => setFocusedField(field.name)}
              onBlur={() => setFocusedField(null)}
              placeholder={field.placeholder}
              rows={field.rows}
              className="w-full px-4 py-3 rounded-xl border-2 bg-transparent text-white placeholder-gray-600 outline-none transition-all duration-300 font-mono text-sm resize-none"
              style={inputStyle(field.name)}
            />
          )}
        </motion.div>
      ))}

      {/* Submit Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="pt-4"
      >
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || isSubmitting}
          className="group relative w-full py-4 rounded-xl border-2 font-bold text-base tracking-wider uppercase transition-all duration-300 overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            borderColor: userColor,
            color: userColor,
            backgroundColor: `${userColor}08`,
            fontFamily: 'IBM Plex Mono, Courier New, monospace',
          }}
        >
          <div 
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: `linear-gradient(135deg, ${userColor}10, transparent, ${userColor}10)` }}
          />
          <div className="relative flex items-center justify-center gap-3">
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <ArrowUpTrayIcon className="w-5 h-5" />
                <span>Create Module</span>
              </>
            )}
          </div>
        </button>
      </motion.div>
    </div>
  )
}
