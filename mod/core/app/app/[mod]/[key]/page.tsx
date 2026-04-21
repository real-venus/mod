"use client";

import { useParams, redirect } from 'next/navigation'

export default function ModuleRedirect() {
  const params = useParams()
  const mod = params.mod as string
  const key = params.key as string
  redirect(`/mod/${mod}/${key}`)
}
