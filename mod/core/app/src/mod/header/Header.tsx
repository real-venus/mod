'use client'

import { WalletHeader } from '@/mod/wallet/WalletHeader'
import { TreasuryHeader } from '@/mod/header/TreasuryHeader'
import { UsersIcon, CubeIcon, TableCellsIcon, ChatBubbleLeftRightIcon, Squares2X2Icon, WrenchScrewdriverIcon, Bars3Icon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { NetworkSelector } from '@/mod/network/NetworkSelector'
import { userContext } from '@/mod/context/UserContext'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useSplitScreenContext } from '@/mod/context/SplitScreenContext'
import { SearchBar } from '@/mod/header/SearchBar'
import { HoverSearchBar } from '@/mod/header/HoverSearchBar'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const defaultNavigation = [
  { id: 'search', name: 'Search', component: 'SearchBar', color: '#d8cc1b' },
  { id: 'chat', name: 'Chat', href: '/chat', icon: ChatBubbleLeftRightIcon, color: '#ef4444' },
  { id: 'mods', name: 'Mods', href: '/mod/explore', icon: CubeIcon, color: '#3b82f6', hasHoverSearch: true },
  { id: 'users', name: 'Users', href: '/user/explore', icon: UsersIcon, color: '#10b981', hasHoverSearch: true },
  { id: 'transactions', name: 'Transactions', href: '/transactions', icon: TableCellsIcon, color: '#f59e0b', hasHoverSearch: true },
  { id: 'buidl', name: 'Buidl', href: '/buidl', icon: WrenchScrewdriverIcon, color: '#a855f7' },
  { id: 'split', name: 'Split Screen', component: 'SplitScreen', color: '#a855f7' },
  { id: 'treasury', name: 'Treasury', component: 'TreasuryHeader', color: '#10b981' },
  { id: 'network', name: 'Network', component: 'NetworkSelector', color: '#3b82f6' },
  { id: 'wallet', name: 'Wallet', component: 'WalletHeader', color: '#f59e0b' },
]

function SortableHeaderItem({ item, pathname, isSplitScreen, toggleSplitScreen, setOrientation, showOrientationMenu, setShowOrientationMenu, showTabMenu, setShowTabMenu, isEditMode, setIsEditMode, isHeaderCollapsed }: any) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !isEditMode })
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isEditMode ? 'grab' : 'default'
  }

  if (isHeaderCollapsed) return null

  const renderComponent = () => {
    if (item.component === 'SearchBar') return <SearchBar />
    if (item.component === 'TreasuryHeader') return <TreasuryHeader />
    if (item.component === 'NetworkSelector') return <NetworkSelector />
    if (item.component === 'WalletHeader') return <WalletHeader />
    
    if (item.component === 'SplitScreen') {
      return (
        <div className="relative">
          {!isSplitScreen ? (
            <button onClick={() => setShowOrientationMenu(!showOrientationMenu)} className="flex items-center justify-center rounded-xl p-3 border-2 border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all backdrop-blur-sm" style={{ height: '60px', width: '60px', boxShadow: '0 0 15px rgba(168, 85, 247, 0.2)' }}>
              <Squares2X2Icon className="w-8 h-8" style={{ color: '#a855f7' }} />
            </button>
          ) : (
            <button onClick={toggleSplitScreen} className="flex items-center justify-center rounded-xl p-3 border-2 border-red-500/30 hover:border-red-500/50 bg-red-500/20 transition-all" style={{ height: '60px', width: '60px' }}>
              <Squares2X2Icon className="w-8 h-8" style={{ color: '#f87171' }} />
            </button>
          )}
          {showOrientationMenu && (
            <div className="absolute top-full left-0 mt-2 bg-gray-900 border border-purple-500/30 rounded-lg shadow-xl overflow-hidden z-50">
              <button onClick={() => { setOrientation('vertical'); toggleSplitScreen(); setShowOrientationMenu(false) }} className="w-full px-4 py-3 text-left text-white hover:bg-purple-500/20 transition-colors flex items-center gap-3 border-b border-gray-800"><Squares2X2Icon className="w-5 h-5" /><span className="text-sm font-medium">Vertical Split</span></button>
              <button onClick={() => { setOrientation('horizontal'); toggleSplitScreen(); setShowOrientationMenu(false) }} className="w-full px-4 py-3 text-left text-white hover:bg-purple-500/20 transition-colors flex items-center gap-3"><Squares2X2Icon className="w-5 h-5 rotate-90" /><span className="text-sm font-medium">Horizontal Split</span></button>
            </div>
          )}
        </div>
      )
    }
    
    if (item.href && item.icon) {
      const isActive = pathname === item.href
      
      if (item.hasHoverSearch) {
        return (
          <div className="relative">
            <Link href={item.href} className={`flex items-center justify-center rounded-xl p-3 transition-all backdrop-blur-sm ${isActive ? 'bg-opacity-20 border-2 shadow-lg' : 'border-2 border-white/20 hover:border-white/40 hover:bg-white/10'}`} style={{ height: '60px', width: '60px', backgroundColor: isActive ? `${item.color}33` : undefined, borderColor: isActive ? `${item.color}4D` : undefined, boxShadow: isActive ? `0 0 20px ${item.color}33` : '0 0 10px rgba(255,255,255,0.05)' }}>
              <item.icon className="w-8 h-8" style={{ color: isActive ? item.color : '#9ca3af' }} />
            </Link>
          </div>
        )
      }
      
      return (
        <div className="relative">
          <Link href={item.href} className={`flex items-center justify-center rounded-xl p-3 transition-all backdrop-blur-sm ${isActive ? 'bg-opacity-20 border-2 shadow-lg' : 'border-2 border-white/20 hover:border-white/40 hover:bg-white/10'}`} style={{ height: '60px', width: '60px', backgroundColor: isActive ? `${item.color}33` : undefined, borderColor: isActive ? `${item.color}4D` : undefined, boxShadow: isActive ? `0 0 20px ${item.color}33` : '0 0 10px rgba(255,255,255,0.05)' }}>
            <item.icon className="w-8 h-8" style={{ color: isActive ? item.color : '#9ca3af' }} />
          </Link>
        </div>
      )
    }
    return null
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {renderComponent()}
    </div>
  )
}

export function Header() {
  const pathname = usePathname()
  const { user } = userContext()
  const { isSplitScreen, toggleSplitScreen, setOrientation } = useSplitScreenContext()
  const [showOrientationMenu, setShowOrientationMenu] = useState(false)
  const [showTabMenu, setShowTabMenu] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [items, setItems] = useState(defaultNavigation)
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-black border-b-2 backdrop-blur-xl" style={{ borderColor: 'rgba(0, 255, 0, 0.25)' }}>
      <div className="flex items-center justify-between px-4 py-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(item => item.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex items-center gap-3 flex-1">
              {items.map((item) => (
                <SortableHeaderItem
                  key={item.id}
                  item={item}
                  pathname={pathname}
                  isSplitScreen={isSplitScreen}
                  toggleSplitScreen={toggleSplitScreen}
                  setOrientation={setOrientation}
                  showOrientationMenu={showOrientationMenu}
                  setShowOrientationMenu={setShowOrientationMenu}
                  showTabMenu={showTabMenu}
                  setShowTabMenu={setShowTabMenu}
                  isEditMode={isEditMode}
                  setIsEditMode={setIsEditMode}
                  isHeaderCollapsed={isHeaderCollapsed}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <button
          onClick={() => setIsEditMode(!isEditMode)}
          className={`ml-4 flex items-center justify-center rounded-xl p-3 border-2 transition-all backdrop-blur-sm ${isEditMode ? 'border-green-500/50 bg-green-500/20' : 'border-white/20 hover:border-white/40 hover:bg-white/10'}`}
          style={{ height: '60px', width: '60px' }}
        >
          <Bars3Icon className="w-8 h-8" style={{ color: isEditMode ? '#10b981' : '#9ca3af' }} />
        </button>
      </div>
    </header>
  )
}
