import dynamic from 'next/dynamic';
import React from 'react'

const ModulePage = dynamic(
  () => import('@/mod/mod/explore/ModExplorePage'),
  { 
    ssr: false
  }
);

export default function Page() {
  return <ModulePage />;
}
