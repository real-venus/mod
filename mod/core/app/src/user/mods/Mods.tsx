"use client";

import React, { useState, useEffect } from 'react'
import { UserType } from '@/types'

export interface ModsProps {
  address?: string
  mods?: any[]
  userData?: UserType
}

export const Mods: React.FC<ModsProps> = ({ address, mods, userData }) => {
  const displayMods = mods || userData?.mods || []
  const displayAddress = address || userData?.key

  return (
    <div className="w-full">
      <div className="text-lg font-bold mb-4">Mods</div>
      {displayMods.length === 0 ? (
        <div className="text-gray-500">No mods found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayMods.map((mod: any, index: number) => (
            <div key={index} className="border border-gray-700 rounded-lg p-4">
              <div className="font-semibold">{mod.name || mod.key || `Mod ${index}`}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Mods
