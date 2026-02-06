"use client";
import { UserType } from '@/mod/types'
import ModCard from '@/mod/mod/ModCard'

export function UserModules({ userData }: { userData: UserType }) {
  const { mods = [] } = userData
  return (
    <div className="grid grid-cols-1  gap-6">
      {mods.map((mod) => (
        <ModCard mod={mod} key={mod.key} />
      ))}
    </div>
  )
}