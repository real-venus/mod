'use client'
import { useState } from 'react'
import UserModules from '@/mod/user/usermods'
import { UserType } from '@/mod/types'

export const Mods = ({ userData }: { userData: UserType }) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <UserModules userData={userData} />
    </div>
  )
}

export default Mods