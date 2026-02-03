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
import Create from '@/mod/user/create'
import { ethers } from 'ethers'
import modConfig from '@/app/mod.json'
import MarketABI from '@/mod/contracts/abi/market/Market.sol/Market.json'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

type TabType = 'mods' | 'sign' | 'transfer' | 'claim' | 'admin' | 'contracts' | 'billing' | 'portfolio' | 'create'

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

  const [searchTerm, setSearchTerm] = useState('')

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
        const data = await client.call('user', { key: userKey , expand: true, update:false })
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
  
  const filteredTabs = displayTabs.filter(tab => 
    tab.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="flex-1 px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="mb-8">
            <UserCard user={userData}/>
          </div>

          {myMod && displayTabs.length > 3 && (
            <div className="relative mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tabs..."
                className="w-full px-4 py-3 pl-12 bg-black/60 border-2 border-white/30 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/60 transition-all font-mono"
              />
              <MagnifyingGlassIcon className="w-5 h-5 text-white/60 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-6">
            {filteredTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-xl font-black text-base uppercase transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-white text-black border-2 border-white scale-105 shadow-lg'
                    : 'bg-black text-white/60 border-2 border-white/30 hover:border-white/50 hover:text-white/80 hover:scale-105'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredTabs.length === 0 && searchTerm && (
            <div className="text-center text-white/40 py-8 font-mono">
              No tabs found matching "{searchTerm}"
            </div>
          )}

          <div className="bg-black border-2 border-white/30 rounded p-6">
            {activeTab === 'mods' && <Mods userData={userData} />}
            {activeTab === 'portfolio' &&  user && <Portfolio />}
            {activeTab === 'transfer' &&  user && <Transfer />}
            {activeTab === 'claim' &&  user && <ClaimMod />}
            {activeTab === 'create' &&  user && <Create />}
            {activeTab === 'admin' && user && <Admin userData={userData} />}
            {activeTab === 'contracts' &&  user && <ContractsInterface />}
            {activeTab === 'billing' &&  user && <Billing />}
          </div>
        </div>
      </main>
    </div>
  )
}
