"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Search } from "lucide-react"
import { Book } from "lucide-react" // Renamed to avoid redeclaration

interface Book {
  id: string
  title: string
  author: string
  highlightsCount: number
}

interface BookSelectorProps {
  value: string
  onChange: (value: string) => void
}

export function BookSelector({ value, onChange }: BookSelectorProps) {
  const [books, setBooks] = useState<Book[]>([])
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchBooks()
  }, [])

  useEffect(() => {
    if (value.length > 0) {
      const filtered = books.filter(
        (book) =>
          book.title.toLowerCase().includes(value.toLowerCase()) ||
          book.author.toLowerCase().includes(value.toLowerCase()),
      )
      setFilteredBooks(filtered)
      setShowSuggestions(true)
    } else {
      setFilteredBooks(books.slice(0, 10)) // Show recent books
      setShowSuggestions(false)
    }
  }, [value, books])

  const fetchBooks = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/readwise/books")
      const data = await response.json()
      setBooks(data.books || [])
    } catch (error) {
      console.error("Error fetching books:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleBookSelect = (book: Book) => {
    onChange(`${book.title} by ${book.author}`)
    setShowSuggestions(false)
  }

  const handleInputFocus = () => {
    if (filteredBooks.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => setShowSuggestions(false), 200)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder="Search for a book or enter a new one..."
          className="pl-10"
        />
      </div>

      {showSuggestions && filteredBooks.length > 0 && (
        <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto">
          <CardContent className="p-0">
            {filteredBooks.map((book) => (
              <Button
                key={book.id}
                variant="ghost"
                className="w-full justify-start p-3 h-auto"
                onClick={() => handleBookSelect(book)}
              >
                <Book className="h-4 w-4 mr-3 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-medium">{book.title}</div>
                  <div className="text-sm text-gray-500">
                    by {book.author} • {book.highlightsCount} highlights
                  </div>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {value && !books.some((book) => `${book.title} by ${book.author}`.toLowerCase() === value.toLowerCase()) && (
        <p className="text-xs text-gray-500 mt-1">This will create a new book entry in Readwise</p>
      )}
    </div>
  )
}
