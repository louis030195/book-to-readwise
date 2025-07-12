"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Loader2, ImageIcon } from "lucide-react"
import Image from "next/image"

interface Photo {
  id: string
  baseUrl: string
  filename: string
  creationTime: string
  mimeType: string
}

interface PhotoGalleryProps {
  photos: Photo[]
  onPhotoSelect: (photo: Photo) => void
  loading: boolean
}

export function PhotoGallery({ photos, onPhotoSelect, loading }: PhotoGalleryProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading photos...</span>
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No photos found</h3>
        <p className="mt-1 text-sm text-gray-500">Make sure you have photos in your Google Photos library</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {photos.map((photo) => (
        <Card
          key={photo.id}
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => onPhotoSelect(photo)}
        >
          <CardContent className="p-2">
            <div className="aspect-square relative overflow-hidden rounded-md">
              <Image
                src={`/api/proxy-image?url=${encodeURIComponent(photo.baseUrl + "=w400-h400-c")}`}
                alt={photo.filename}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 truncate">{photo.filename}</p>
            <p className="text-xs text-gray-400">{new Date(photo.creationTime).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
