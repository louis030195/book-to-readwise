"use client";

import type React from "react";
import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, BookOpen, Save, ExternalLink } from "lucide-react";
import Image from "next/image";
import { BookSelector } from "./book-selector";
import { Input } from "@/components/ui/input";

interface Photo {
  id: string;
  baseUrl: string;
  filename: string;
  mimeType: string;
}

interface TextExtractorProps {
  photo: Photo;
  onBack: () => void;
}

interface ExtractedText {
  fullText: string;
  confidence: number;
  isBookContent: boolean;
  suggestedBookTitle?: string;
  suggestedAuthor?: string;
  tags?: string[];
}

interface SelectedBook {
  id: string | null;
  title: string;
  author?: string;
}

interface CachedHighlight {
  imageId: string;
  extractedText: ExtractedText;
  selectedText: string;
  selectedBook: SelectedBook;
  customNote: string;
  tags: string[];
  savedToReadwise: boolean;
  savedBookId?: string;
  savedAt?: string;
}

export function TextExtractor({ photo, onBack }: TextExtractorProps) {
  const [extractedText, setExtractedText] = useState<ExtractedText | null>(
    null
  );
  const [selectedText, setSelectedText] = useState("");
  const [selectedBook, setSelectedBook] = useState<SelectedBook>({
    id: null,
    title: "",
  });
  const [customNote, setCustomNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedBookId, setSavedBookId] = useState<string | null>(null);

  useEffect(() => {
    // Check if we have cached data for this image
    const cachedData = getCachedHighlight(photo.id);
    if (cachedData) {
      console.log("Loading cached highlight data for image:", photo.id);
      setExtractedText(cachedData.extractedText);
      setSelectedText(cachedData.selectedText);
      setSelectedBook(cachedData.selectedBook);
      setCustomNote(cachedData.customNote);
      setTags(cachedData.tags);
      if (cachedData.savedToReadwise) {
        setSavedBookId(cachedData.savedBookId || null);
      }
    } else {
      extractText();
    }
  }, [photo]);

  // Auto-save changes to cache as user edits
  useEffect(() => {
    if (extractedText) {
      saveCachedHighlight({
        imageId: photo.id,
        extractedText: extractedText,
        selectedText: selectedText,
        selectedBook: selectedBook,
        customNote: customNote,
        tags: tags,
        savedToReadwise: !!savedBookId,
        savedBookId: savedBookId || undefined,
        savedAt: savedBookId ? new Date().toISOString() : undefined,
      });
    }
  }, [
    selectedText,
    selectedBook,
    customNote,
    tags,
    extractedText,
    photo.id,
    savedBookId,
  ]);

  const getCachedHighlight = (imageId: string): CachedHighlight | null => {
    try {
      const cached = localStorage.getItem(`highlight_${imageId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error("Error loading cached highlight:", error);
      return null;
    }
  };

  const saveCachedHighlight = (data: CachedHighlight) => {
    try {
      localStorage.setItem(`highlight_${data.imageId}`, JSON.stringify(data));
      console.log("Cached highlight data for image:", data.imageId);
    } catch (error) {
      console.error("Error caching highlight:", error);
    }
  };

  const extractText = async () => {
    if (loading) {
      console.log("Text extraction already in progress, skipping...");
      return;
    }

    setLoading(true);
    try {
      // Try different URL formats for better compatibility
      const imageUrl = `${photo.baseUrl}=w1024-h1024-c`;
      console.log("Extracting text from:", imageUrl);

      const response = await fetch("/api/extract-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: imageUrl,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Error extracting text:", text);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ExtractedText = await response.json();
      console.log("Text extraction result:", data);
      setExtractedText(data);
      setSelectedText(data.fullText || "");

      if (data.isBookContent && data.suggestedBookTitle && !selectedBook.id) {
        setSelectedBook({
          id: null,
          title: data.suggestedBookTitle,
          author: data.suggestedAuthor || "",
        });
      }

      if (data.tags) {
        setTags(data.tags);
      }

      // Cache the extracted data
      saveCachedHighlight({
        imageId: photo.id,
        extractedText: data,
        selectedText: data.fullText || "",
        selectedBook:
          data.isBookContent && data.suggestedBookTitle
            ? {
                id: null,
                title: data.suggestedBookTitle,
                author: data.suggestedAuthor || "",
              }
            : { id: null, title: "" },
        customNote: "",
        tags: data.tags || [],
        savedToReadwise: false,
      });
    } catch (error) {
      console.error("Error extracting text:", error);
      setExtractedText({
        fullText: "Failed to extract text from image",
        confidence: 0,
        isBookContent: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHighlight = async () => {
    if (!selectedText?.trim() || !selectedBook?.title?.trim()) return;

    setSaving(true);
    try {
      const payload = {
        text: selectedText,
        book_id: selectedBook.id,
        title: selectedBook.title,
        author: selectedBook.author,
        // note: customNote,
        tags: tags,
        source: photo.filename,
      };

      console.log("Sending highlight data:", payload);

      const response = await fetch("/api/readwise/highlight", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.bookId) {
          setSavedBookId(result.bookId);
        }

        // Update cache to mark as saved to Readwise
        if (extractedText) {
          saveCachedHighlight({
            imageId: photo.id,
            extractedText: extractedText,
            selectedText: selectedText,
            selectedBook: selectedBook,
            customNote: customNote,
            tags: tags,
            savedToReadwise: true,
            savedBookId: result.bookId,
            savedAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error("Error saving highlight:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <Button variant="ghost" onClick={onBack} className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Gallery
            </Button>
            <h1 className="text-xl font-semibold">
              Extract Text & Create Highlight
            </h1>
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
                  src={`/api/proxy-image?url=${encodeURIComponent(
                    photo.baseUrl + "=w800-h1000"
                  )}`}
                  alt={photo.filename}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  onError={(e) => {
                    console.error("Image failed to load:", e);
                    // Try alternative URL format
                    const img = e.target as HTMLImageElement;
                    if (img.src.includes("=w800-h1000")) {
                      img.src = `/api/proxy-image?url=${encodeURIComponent(
                        photo.baseUrl + "=s1000"
                      )}`;
                    } else if (img.src.includes("=s1000")) {
                      img.src = `/api/proxy-image?url=${encodeURIComponent(
                        photo.baseUrl + "=w800"
                      )}`;
                    }
                  }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">{photo.filename}</p>
              <p className="text-sm text-gray-400 mt-1">
                Type: {photo.mimeType}
              </p>
              <div className="mt-2">
                <a
                  href={`${photo.baseUrl}=s1000`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700 text-sm"
                >
                  Open image in new tab
                </a>
              </div>
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
                      Confidence:{" "}
                      {Math.round((extractedText.confidence || 0) * 100)}%
                    </div>
                    <Textarea
                      value={selectedText}
                      onChange={(e) => setSelectedText(e.target.value)}
                      placeholder="Edit the extracted text or select the portion you want to highlight..."
                      className="min-h-[200px]"
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Failed to extract text. Please try again.
                  </div>
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
                    <BookSelector
                      value={selectedBook}
                      onChange={setSelectedBook}
                    />
                  </div>

                  <div>
                    <Label htmlFor="custom-note">
                      Additional Note (Optional)
                    </Label>
                    <Textarea
                      id="custom-note"
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      placeholder="Add any additional notes or context..."
                      className="min-h-[100px]"
                    />
                  </div>

                  <div>
                    <Label htmlFor="tags-input">Tags</Label>
                    <Input
                      id="tags-input"
                      value={tags.join(", ")}
                      onChange={(e) =>
                        setTags(
                          e.target.value
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter((tag) => tag.length > 0)
                        )
                      }
                      placeholder="Add tags, separated by commas..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      AI-suggested tags. Edit as needed.
                    </p>
                  </div>

                  <Button
                    onClick={handleSaveHighlight}
                    disabled={
                      !selectedText?.trim() ||
                      !selectedBook?.title?.trim() ||
                      saving
                    }
                    className="w-full"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save to Readwise
                  </Button>

                  {savedBookId && (
                    <Button asChild variant="outline" className="w-full">
                      <a
                        href={`https://readwise.io/bookreview/${savedBookId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View on Readwise
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
