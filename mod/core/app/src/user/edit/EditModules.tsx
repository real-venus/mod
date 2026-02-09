"use client";
import { UserType } from '@/types'
import ModCard from '@/mod/ModCard'
import { UpdateMod } from '@/user/UpdateMod'
import { useState } from 'react'
import { Pencil } from 'lucide-react'

export function EditModules({ userData }: { userData: UserType }) {
  const mods = userData?.mods ?? []
  const [selectedMod, setSelectedMod] = useState<any>(null)

  return (
    <div className="space-y-6">
      {selectedMod ? (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedMod(null)}
            className="px-4 py-2 bg-purple-500/20 border-2 border-purple-500/40 rounded-lg text-purple-400 hover:bg-purple-500/30 transition-all font-bold uppercase text-sm"
          >
            ← Back to Modules
          </button>
          <UpdateMod mod={selectedMod} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {mods.map((mod) => (
            <div key={mod.key} className="relative group">
              <ModCard mod={mod} />
              <button
                onClick={() => setSelectedMod(mod)}
                className="absolute top-4 right-4 p-3 bg-blue-500/20 border-2 border-blue-500/40 rounded-lg text-blue-400 hover:bg-blue-500/30 hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                title="Edit Module"
              >
                <Pencil className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
