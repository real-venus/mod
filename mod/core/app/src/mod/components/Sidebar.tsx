'use client'

import { WalletHeader } from '@/mod/wallet/WalletHeader'
import { TreasuryHeader } from '@/mod/header/TreasuryHeader'
import { UsersIcon, CubeIcon, TableCellsIcon, ChatBubbleLeftRightIcon, Squares2X2Icon, PlusIcon, Bars3Icon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { NetworkSelector } from '@/mod/network/NetworkSelector'
import { userContext } from '@/mod/context/UserContext'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useSplitScreenContext } from '@/mod/context/SplitScreenContext'
import { SearchBar } from '@/mod/header/SearchBar'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const defaultNavigation = [
  { id: 'search', name: 'Search', component: 'SearchBar', color: '#d8cc1b' },
  { id: 'chat', name: 'Chat', href: '/chat', icon: ChatBubbleLeftRightIcon, color: '#ef4444' },
  { id: 'mods', name: 'Mods', href: '/mod/explore', icon: CubeIcon, color: '#3b82f6' },
  { id: 'users', name: 'Users', href: '/user/explore', icon: UsersIcon, color: '#10b981' },
  { id: 'transactions', name: 'Transactions', href: '/transactions', icon: TableCellsIcon, color: '#f59e0b' },
  { id: 'split', name: 'Split Screen', component: 'SplitScreen', color: '#a855f7' },
  { id: 'treasury', name: 'Treasury', component: 'TreasuryHeader', color: '#10b981' },
  { id: 'network', name: 'Network', component: 'NetworkSelector', color: '#3b82f6' },
  { id: 'wallet', name: 'Wallet', component: 'WalletHeader', color: '#f59e0b' },
]

function SortableSidebarItem({ item, pathname, hoveredSection, setHoveredSection, isSplitScreen, toggleSplitScreen, setOrientation, showOrientationMenu, setShowOrientationMenu, showTabMenu, setShowTabMenu, isEditMode, isExpanded }: any) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !isEditMode })
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isEditMode ? 'grab' : 'default'
  }

  const renderComponent = () => {
    if (item.component === 'SearchBar') return isExpanded ? <SearchBar /> : null
    if (item.component === 'TreasuryHeader') return isExpanded ? <TreasuryHeader /> : null
    if (item.component === 'NetworkSelector') return isExpanded ? <NetworkSelector /> : null
    if (item.component === 'WalletHeader') return isExpanded ? <WalletHeader /> : null
    
    if (item.component === 'SplitScreen') {
      return (
        <div className="relative" onMouseEnter={() => setHoveredSection('Split Screen')} onMouseLeave={() => setHoveredSection(null)}>
          {!isSplitScreen ? (
            <button onClick={() => setShowOrientationMenu(!showOrientationMenu)} className="flex items-center justify-center rounded-xl p-3 border-2 border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all backdrop-blur-sm w-full" style={{ boxShadow: '0 0 15px rgba(168, 85, 247, 0.2)' }}>
              <Squares2X2Icon className="w-6 h-6" style={{ color: '#a855f7' }} />
            </button>
          ) : (
            <button onClick={toggleSplitScreen} className="flex items-center justify-center rounded-xl p-3 border-2 border-red-500/30 hover:border-red-500/50 bg-red-500/20 transition-all w-full">
              <Squares2X2Icon className="w-6 h-6" style={{ color: '#f87171' }} />
            </button>
          )}
          <AnimatePresence>
            {hoveredSection === 'Split Screen' && isExpanded && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }} className="absolute left-full ml-2 top-0 pointer-events-none z-50">
                <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl border border-purple-500/30 whitespace-nowrap text-sm font-medium">Split Screen</div>
              </motion.div>
            )}
          </AnimatePresence>
          {showOrientationMenu && (
            <div className="absolute left-full ml-2 top-0 bg-gray-900 border border-purple-500/30 rounded-lg shadow-xl overflow-hidden z-50">
              <button onClick={() => { setOrientation('vertical'); toggleSplitScreen(); setShowOrientationMenu(false) }} className="w-full px-4 py-3 text-left text-white hover:bg-purple-500/20 transition-colors flex items-center gap-3 border-b border-gray-800"><Squares2X2Icon className="w-5 h-5" /><span className="text-sm font-medium">Vertical Split</span></button>
              <button onClick={() => { setOrientation('horizontal'); toggleSplitScreen(); setShowOrientationMenu(false) }} className="w-full px-4 py-3 text-left text-white hover:bg-purple-500/20 transition-colors flex items-center gap-3"><Squares2X2Icon className="w-5 h-5 rotate-90" /><span className="text-sm font-medium">Horizontal Split</span></button>
            </div>
          )}
        </div>
      )
    }
    
    if (item.href && item.icon) {
      const isActive = pathname === item.href
      return (
        <div className="relative" onMouseEnter={() => setHoveredSection(item.name)} onMouseLeave={() => setHoveredSection(null)}>
          <Link href={item.href} className={`flex items-center justify-center rounded-xl p-3 transition-all backdrop-blur-sm w-full ${isActive ? 'bg-opacity-20 border-2 shadow-lg' : 'border-2 border-white/20 hover:border-white/40 hover:bg-white/10'}`} style={{ backgroundColor: isActive ? `${item.color}33` : undefined, borderColor: isActive ? `${item.color}4D` : undefined, boxShadow: isActive ? `0 0 20px ${item.color}33` : '0 0 10px rgba(255,255,255,0.05)' }}>
            <item.icon className="w-6 h-6" style={{ color: isActive ? item.color : '#9ca3af' }} />
          </Link>
          <AnimatePresence>
            {hoveredSection === item.name && isExpanded && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }} className="absolute left-full ml-2 top-1/2 -translate-y-1/2 pointer-events-none z-50">
                <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl border whitespace-nowrap text-sm font-medium" style={{ borderColor: `${item.color}4D` }}>{item.name}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )
    }
    return null
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-2">
      {renderComponent()}
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { user } = userContext()
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)
  const { isSplitScreen, toggleSplitScreen, setOrientation } = useSplitScreenContext()
  const [showOrientationMenu, setShowOrientationMenu] = useState(false)
  const [showTabMenu, setShowTabMenu] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [items, setItems] = useState(defaultNavigation)
  const [isExpanded, setIsExpanded] = useState(false)

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
    <aside className={`fixed left-0 top-0 h-full bg-black border-r-2 backdrop-blur-xl transition-all duration-300 z-40 ${isExpanded ? 'w-64' : 'w-20'}`} style={{ borderColor: 'rgba(0, 255, 0, 0.25)' }}>
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center justify-between mb-6">
          {isExpanded && <h2 className="text-xl font-bold text-green-400">Navigation</h2>}
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-lg border-2 border-green-500/30 hover:border-green-500/50 hover:bg-green-500/10 transition-all">
            {isExpanded ? <ChevronLeftIcon className="w-5 h-5 text-green-400" /> : <ChevronRightIcon className="w-5 h-5 text-green-400" />}
          </button>
        </div>
        
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
            <div className="flex-1 overflow-y-auto">
              {items.map((item) => (
                <SortableSidebarItem
                  key={item.id}
                  item={item}
                  pathname={pathname}
                  hoveredSection={hoveredSection}
                  setHoveredSection={setHoveredSection}
                  isSplitScreen={isSplitScreen}
                  toggleSplitScreen={toggleSplitScreen}
                  setOrientation={setOrientation}
                  showOrientationMenu={showOrientationMenu}
                  setShowOrientationMenu={setShowOrientationMenu}
                  showTabMenu={showTabMenu}
                  setShowTabMenu={setShowTabMenu}
                  isEditMode={isEditMode}
                  isExpanded={isExpanded}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        
        <button onClick={() => setIsEditMode(!isEditMode)} className={`mt-4 flex items-center ${isExpanded ? 'justify-start gap-3' : 'justify-center'} rounded-xl p-3 border-2 transition-all backdrop-blur-sm w-full ${isEditMode ? 'border-green-500/50 bg-green-500/20' : 'border-white/20 hover:border-white/40 hover:bg-white/10'}`}>
          <Bars3Icon className="w-6 h-6" style={{ color: isEditMode ? '#10b981' : '#9ca3af' }} />
          {isExpanded && <span className="text-sm font-medium" style={{ color: isEditMode ? '#10b981' : '#9ca3af' }}>Edit Mode</span>}
        </button>
      </div>
    </aside>
  )
}
