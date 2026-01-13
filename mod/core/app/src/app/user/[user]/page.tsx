'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { userContext } from '@/mod/context'
import { UserType } from '@/mod/types'
import { Loading } from '@/mod/ui/Loading'
import { UserCard } from '@/mod/user/UserCard'
import Transfer from '@/mod/user/transfer'
import RegUpdate from '@/mod/user/regupdate'
import ClaimMod from '@/mod/user/claim'
import { UserModules } from '@/mod/user/usermods/UserModules'
import { Admin } from '@/mod/user/admin/Admin'

type TabType = 'mods' | 'sign' | 'transfer' | 'regupdate' | 'claim' | 'admin'

export default function UserPage() {
  const params = useParams()
  const userKey = params?.user as string
  const { client, user } = userContext()
  const [userData, setUserData] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('mods')
  const { user: currentUser } = userContext()
  const myMod = currentUser && currentUser.key === userKey

  useEffect(() => {
    const fetchUser = async () => {
      if (!client || !userKey) return
      setLoading(true)
      setError(null)
      try {
        const data = await client.call('user', { address: userKey })
        setUserData(data as UserType)
      } catch (err: any) {
        console.error('Error fetching user:', err)
        setError(err?.message || 'Failed to load user')
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [client, userKey])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (error || !userData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-400 mb-4">ERROR</h1>
          <p className="text-xl text-white/70">{error || 'User not found'}</p>
        </div>
      </div>
    )
  }

  let tabs: { id: TabType; label: string; color: string }[] = [
    { id: 'transfer', label: 'transfer', color: 'blue' },
    { id: 'mods', label: 'mods', color: 'purple' },
    { id: 'regupdate', label: 'register/update', color: 'green' },
    { id: 'claim', label: 'claim', color: 'pink' },
    { id: 'admin', label: 'admin', color: 'red' },
  ]

  if (!myMod) {
    tabs = tabs.filter(tab => tab.id === 'mods')
  }

  const getButtonColors = (tabColor: string, isActive: boolean) => {
    const colorMap: Record<string, { active: string; inactive: string }> = {
      blue: {
        active: 'bg-black text-white border-2 border-white',
        inactive: 'bg-black text-white/60 border-2 border-white/30 hover:border-white/50'
      },
      purple: {
        active: 'bg-black text-white border-2 border-white',
        inactive: 'bg-black text-white/60 border-2 border-white/30 hover:border-white/50'
      },
      green: {
        active: 'bg-black text-white border-2 border-white',
        inactive: 'bg-black text-white/60 border-2 border-white/30 hover:border-white/50'
      },
      pink: {
        active: 'bg-black text-white border-2 border-white',
        inactive: 'bg-black text-white/60 border-2 border-white/30 hover:border-white/50'
      },
      red: {
        active: 'bg-black text-white border-2 border-white',
        inactive: 'bg-black text-white/60 border-2 border-white/30 hover:border-white/50'
      }
    }
    return isActive ? colorMap[tabColor].active : colorMap[tabColor].inactive
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="flex-1 px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="mb-8">
            <UserCard user={userData}/>
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded font-black text-base uppercase transition-all duration-300 ${
                  getButtonColors(tab.color, activeTab === tab.id)
                } ${activeTab === tab.id ? 'scale-105' : 'hover:scale-105'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-black border-2 border-white/30 rounded p-6">
            {activeTab === 'mods' && <UserModules userData={userData} />}
            {activeTab === 'transfer' && client?.key && user && <Transfer />}
            {activeTab === 'regupdate' && client?.key && user && <RegUpdate />}
            {activeTab === 'claim' && client?.key && user && <ClaimMod />}
            {activeTab === 'admin' && client?.key && user && <Admin userData={userData} />}
          </div>
        </div>
      </main>
    </div>
  )
}
