"use client"

import type React from "react";
import { Button } from "@/components/ui/button"
import { useState } from "react"
import type { LucideIcon } from "lucide-react";
import { Camera, Loader2 } from "lucide-react"

interface GooglePhotosAuthProps {
  onAuthSuccess: () => void
}

export function GooglePhotosAuth({ onAuthSuccess }: GooglePhotosAuthProps) {
  const [loading, setLoading] = useState(false)

  const handleAuth = async () => {
    setLoading(true)
    try {
      // Redirect to Google OAuth
      window.location.href = "/api/auth/google"
    } catch (error) {
      console.error("Auth error:", error)
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleAuth} disabled={loading} className="w-full" size="lg">
      {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />}
      Connect Google Photos
    </Button>
  )
}
