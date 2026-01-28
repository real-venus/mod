'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { userContext } from '@/mod/context'
import { UserType } from '@/mod/types'
import { Loading } from '@/mod/ui/Loading'
import { UserCard } from '@/mod/user/UserCard'
import Transfer from '@/mod/user/transfer'
import ClaimMod from '@/mod/user/claim'
import Mods from '@/mod/user/mods'
import ContractsInterface from '@/mod/user/contracts/Contracts'
import { Admin } from '@/mod/user/admin/Admin'
import { Portfolio } from '@/mod/user/portfolio/Portfolio'
import { Billing } from '@/mod/user/billing'
import RegUpdate from '@/mod/user/regupdate'
import { TabManager } from '@/mod/user/TabManager'
import { ethers } from 'ethers'
import modConfig from '@/app/mod.json'
import MarketABI from '@/mod/contracts/abi/market/Market.sol/Market.json'

type TabType = 'mods' | 'sign' | 'transfer' | 'claim' | 'admin' | 'contracts' | 'billing' | 'portfolio' | 'regupdate'

const DEFAULT_TABS: { id: TabType; label: string; color: string }[] = [
  { id: 'transfer', label: 'transfer', color: 'blue' },
  { id: 'mods', label: 'mods', color: 'purple' },
  { id: 'portfolio', label: 'portfolio', color: 'indigo' },
  { id: 'claim', label: 'claim', color: 'pink' },
  { id: 'admin', label: 'admin', color: 'red' },
  { id: 'contracts', label: 'contracts', color: 'cyan' },
  { id: 'billing', label: 'billing', color: 'yellow' },
]

export default function UserPage() {
  const params = useParams()
  const userKey = params?.user as string
  const { client, user } = userContext()
  const [userData, setUserData] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [marketCredit, setMarketCredit] = useState<number>(0)
  const { user: currentUser } = userContext()
  const myMod = currentUser && currentUser.key === userKey

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`user_tab_${userKey}`)
      return (saved as TabType) || 'mods'
    }
    return 'mods'
  })

  const [userTabs, setUserTabs] = useState<{ id: TabType; label: string; color: string }[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('user_page_tabs')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          return DEFAULT_TABS
        }
      }
    }
    return DEFAULT_TABS
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_page_tabs', JSON.stringify(userTabs))
    }
  }, [userTabs])

  useEffect(() => {
    if (typeof window !== 'undefined' && userKey) {
      localStorage.setItem(`user_tab_${userKey}`, activeTab)
    }
  }, [activeTab, userKey])

  useEffect(() => {
    const fetchUser = async () => {
      if (!client || !userKey) return
      setLoading(true)
      setError(null)
      try {
        const data = await client.call('user', { address: userKey })
        setUserData(data as UserType)
        
        if (user?.key && typeof window !== 'undefined' && window.ethereum) {
          try {
            const network = 'testnet'
            const chainConfig = modConfig.chain?.[network]
            if (!chainConfig) throw new Error('Chain config not found')
            
            const provider = new ethers.BrowserProvider(window.ethereum)
            const marketAddress = chainConfig.contracts.Market.address
            const marketContract = new ethers.Contract(marketAddress, MarketABI.abi, provider)
            
            let balance = await marketContract.balanceOf(user.key)
            let decimals = await marketContract.decimals()
            decimals = Number(decimals) + 10
            balance = parseFloat(ethers.formatUnits(balance, decimals))
        
            setMarketCredit(balance)
          } catch (err) {
            console.error('Error fetching market credit:', err)
            setMarketCredit(0)
          }
        }
      } catch (err: any) {
        console.error('Error fetching user:', err)
        setError(err?.message || 'Failed to load user')
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [client, userKey, user])

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

  let displayTabs = myMod ? userTabs : userTabs.filter(tab => tab.id === 'mods')

  const getButtonColors = (tabColor: string, isActive: boolean) => {
    const colorMap: Record<string, { active: string; inactive: string }> = {
      blue: { active: 'bg-black text-white border-2 border-white', inactive: 'bg-black text-white/60 border-2 border-white/30 hover:border-white/50' },
      purple: { active: 'bg-black text-white border-2 border-white', inactive: 'bg-black text-white/60 border-2 border-white/30 hover:border-white/50' },
      indigo: { active: 'bg-black text-white border-2 border-white', inactive: 'bg-black text-white/60 border-2 border-white/30 hover:border-white/50' },
      green: { active: 'bg-black text-white border-2 border-white', inactive: 'bg-black text-white/60 border-2 border-white/30 hover:border-white/50' },
      orange: { active: 'bg-black text-white border-2 border-white', inactive: 'bg-black text-white/60 border-2 border-white/30 hover:border-white/50' },
      pink: { active: 'bg-black text-white border-2 border-white', inactive: 'bg-black text-white/60 border-2 border-white/30 hover:border-white/50' },
      red: { active: 'bg-black text-white border-2 border-white', inactive: 'bg-black text-white/60 border-2 border-white/30 hover:border-white/50' },
      cyan: { active: 'bg-black text-white border-2 border-white', inactive: 'bg-black text-white/60 border-2 border-white/30 hover:border-white/50' },
      yellow: { active: 'bg-black text-white border-2 border-white', inactive: 'bg-black text-white/60 border-2 border-white/30 hover:border-white/50' }
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

          {myMod && (
            <TabManager
              userTabs={userTabs}
              onTabsChange={setUserTabs}
              availableTabs={DEFAULT_TABS}
            />
          )}

          <div className="flex flex-wrap gap-3 mb-6">
            {displayTabs.map((tab) => (
              <div key={tab.id} className="relative group">
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 rounded font-black text-base uppercase transition-all duration-300 ${
                    getButtonColors(tab.color, activeTab === tab.id)
                  } ${activeTab === tab.id ? 'scale-105' : 'hover:scale-105'}`}
                >
                  {tab.label}
                </button>
              </div>
            ))}
          </div>

          <div className="bg-black border-2 border-white/30 rounded p-6">
            {activeTab === 'mods' && <Mods userData={userData} />}
            {activeTab === 'portfolio' &&  user && <Portfolio />}
            {activeTab === 'transfer' &&  user && <Transfer />}
            {activeTab === 'claim' &&  user && <ClaimMod />}
            {activeTab === 'regupdate' &&  user && <RegUpdate />}
            {activeTab === 'admin' && user && <Admin userData={userData} />}
            {activeTab === 'contracts' &&  user && <ContractsInterface />}
            {activeTab === 'billing' &&  user && <Billing />}
          </div>
        </div>
      </main>
    </div>
  )
}
