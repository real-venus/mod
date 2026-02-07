"use client";

import React from 'react'

export function SkeletonCard() {
  return (
    <div className="relative border-2 border-gray-700/40 rounded-xl overflow-hidden backdrop-blur-sm animate-pulse">
      <div className="bg-gradient-to-br from-gray-800/20 to-gray-900/20 p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              {/* Icon skeleton */}
              <div className="w-10 h-10 bg-gray-700/40 rounded-lg" />

              {/* Name skeleton */}
              <div className="flex-1 bg-gradient-to-r from-gray-700/40 to-gray-800/40 rounded-lg h-10" />
            </div>

            {/* Tags skeleton */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-gray-700/40 rounded-lg h-8 w-24" />
              <div className="bg-gray-700/40 rounded-lg h-8 w-32" />
              <div className="bg-gray-700/40 rounded-lg h-8 w-28" />
            </div>
          </div>
        </div>
      </div>

      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]">
        <div className="h-full w-full bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 6, columns = 2 }: { count?: number; columns?: number }) {
  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  }[columns] || 'grid-cols-1 md:grid-cols-2'

  return (
    <div className={`grid ${gridColsClass} gap-6`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
