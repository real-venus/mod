"use client"

import ModManage from '@/mod/manage/ModManage'

export default function AppsPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="px-6 py-4">
        <ModManage />
      </div>
    </div>
  )
}
