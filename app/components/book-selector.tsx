"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import { Book as BookIcon } from "lucide-react";

interface BookItem {
  id: string;
  title: string;
  author: string;
  highlightsCount: number;
}

interface SelectedBook {
  id: string | null;
  title: string;
  author?: string;
}

interface BookSelectorProps {
  value: SelectedBook;
  onChange: (value: SelectedBook) => void;
}

export function BookSelector({ value, onChange }: BookSelectorProps) {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<BookItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetchBooks();
  }, []);

  useEffect(() => {
    if (value.title.length > 0) {
      const filtered = books.filter(
        (book) =>
          book.title.toLowerCase().includes(value.title.toLowerCase()) ||
          book.author.toLowerCase().includes(value.title.toLowerCase())
      );
      setFilteredBooks(filtered);
      setShowSuggestions(true);

      // Auto-select the first matching book if:
      // 1. We have matches
      // 2. Current selection doesn't have an ID (meaning it's not already selected)
      // 3. The typed title closely matches the first result
      if (filtered.length > 0 && !value.id) {
        const firstMatch = filtered[0];
        // Only auto-select when the typed title EXACTLY matches an existing book (case-insensitive).
        const isExactMatch =
          firstMatch.title.trim().toLowerCase() ===
          value.title.trim().toLowerCase();

        if (isExactMatch) {
          console.log("Auto-selecting first matching book:", firstMatch);
          onChange({
            id: firstMatch.id,
            title: firstMatch.title,
            author: firstMatch.author,
          });
        }
      }
    } else {
      setFilteredBooks(books.slice(0, 10)); // Show recent books
      setShowSuggestions(false);
    }
  }, [value, books, onChange]);

  const fetchBooks = async () => {
    try {
      const response = await fetch("/api/readwise/books");
      const data = await response.json();
      setBooks(data.books || []);
    } catch (error) {
      console.error("Error fetching books:", error);
    } finally {
      /* no-op */
    }
  };

  const handleBookSelect = (book: BookItem) => {
    console.log("Selected book from dropdown:", book);
    onChange({ id: book.id, title: book.title, author: book.author });
    setShowSuggestions(false);
  };

  const handleInputFocus = () => {
    if (filteredBooks.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Use a longer delay to ensure clicks are processed
    setTimeout(() => setShowSuggestions(false), 300);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={value.title}
          // Reset book ID when the user manually edits the title to ensure
          // we don't accidentally attach the highlight to a previously-selected book.
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ id: null, title: e.target.value, author: value.author })
          }
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder="Search for a book or enter a new one..."
          className="pl-10"
        />
      </div>

      {showSuggestions && filteredBooks.length > 0 && (
        <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto">
          <CardContent className="p-0">
            {filteredBooks.map((book: BookItem) => (
              <div
                key={book.id}
                className="w-full justify-start p-3 h-auto cursor-pointer hover:bg-gray-50 flex items-center"
                onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
                  e.preventDefault();
                  handleBookSelect(book);
                }}
              >
                <BookIcon className="h-4 w-4 mr-3 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-medium">{book.title}</div>
                  <div className="text-sm text-gray-500">
                    by {book.author} • {book.highlightsCount} highlights
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {value.title && !value.id && (
        <p className="text-xs text-red-500 mt-1">
          ⚠️ This will create a new book entry in Readwise
        </p>
      )}

      {value.title && value.id && (
        <p className="text-xs text-green-600 mt-1">
          ✅ Selected existing book (ID: {value.id})
        </p>
      )}
    </div>
  );
}
