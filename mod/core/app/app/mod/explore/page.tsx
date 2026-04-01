import dynamic from 'next/dynamic';
import React from 'react'

export const dynamicParams = true

const ModulePage = dynamic(
  () => import('@/mod/explore/ModExplorePage'),
  { 
    ssr: false
  }
);

export default function Page() {
  return <ModulePage />;
}
