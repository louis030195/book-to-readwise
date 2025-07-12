"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Loader2, BookOpen, Save } from "lucide-react"
import Image from "next/image"
import { BookSelector } from "./book-selector"

interface Photo {
  id: string
  baseUrl: string
  filename: string
  creationTime: string
  mimeType: string
}

interface TextExtractorProps {
  photo: Photo
  onBack: () => void
}

interface ExtractedText {
  fullText: string
  confidence: number
}

export function TextExtractor({ photo, onBack }: TextExtractorProps) {
  const [extractedText, setExtractedText] = useState<ExtractedText | null>(null)
  const [selectedText, setSelectedText] = useState("")
  const [selectedBook, setSelectedBook] = useState("")
  const [customNote, setCustomNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    extractText()
  }, [photo])

  const extractText = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/extract-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: `${photo.baseUrl}=w1024-h1024`,
        }),
      })

      const data = await response.json()
      setExtractedText(data)
      setSelectedText(data.fullText)
    } catch (error) {
      console.error("Error extracting text:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveHighlight = async () => {
    if (!selectedText.trim() || !selectedBook.trim()) return

    setSaving(true)
    try {
      const response = await fetch("/api/readwise/highlight", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: selectedText,
          book: selectedBook,
          note: customNote,
          source: photo.filename,
        }),
      })

      if (response.ok) {
        // Show success message or redirect
        onBack()
      }
    } catch (error) {
      console.error("Error saving highlight:", error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <Button variant="ghost" onClick={onBack} className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Gallery
            </Button>
            <h1 className="text-xl font-semibold">Extract Text & Create Highlight</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Photo Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-[3/4] relative overflow-hidden rounded-lg">
                <Image
                  src={`${photo.baseUrl}=w800-h1000`}
                  alt={photo.filename}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">{photo.filename}</p>
            </CardContent>
          </Card>

          {/* Text Extraction & Highlight Creation */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BookOpen className="h-5 w-5 mr-2" />
                  Extracted Text
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Extracting text from image...
                  </div>
                ) : extractedText ? (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600">
                      Confidence: {Math.round((extractedText.confidence || 0) * 100)}%
                    </div>
                    <Textarea
                      value={selectedText}
                      onChange={(e) => setSelectedText(e.target.value)}
                      placeholder="Edit the extracted text or select the portion you want to highlight..."
                      className="min-h-[200px]"
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">Failed to extract text. Please try again.</div>
                )}
              </CardContent>
            </Card>

            {extractedText && (
              <Card>
                <CardHeader>
                  <CardTitle>Create Highlight</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="book-selector">Book</Label>
                    <BookSelector value={selectedBook} onChange={setSelectedBook} />
                  </div>

                  <div>
                    <Label htmlFor="custom-note">Additional Note (Optional)</Label>
                    <Textarea
                      id="custom-note"
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      placeholder="Add any additional notes or context..."
                      className="min-h-[100px]"
                    />
                  </div>

                  <Button
                    onClick={handleSaveHighlight}
                    disabled={!selectedText.trim() || !selectedBook.trim() || saving}
                    className="w-full"
                  >
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save to Readwise
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
