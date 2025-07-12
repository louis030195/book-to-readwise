import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const readwiseToken = process.env.READWISE_ACCESS_TOKEN

  if (!readwiseToken) {
    return NextResponse.json({ error: "Readwise token not configured" }, { status: 500 })
  }

  try {
    const response = await fetch("https://readwise.io/api/v2/books/", {
      headers: {
        Authorization: `Token ${readwiseToken}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch books from Readwise")
    }

    const data = await response.json()

    const books =
      data.results?.map((book: any) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        highlightsCount: book.num_highlights,
      })) || []

    return NextResponse.json({ books })
  } catch (error) {
    console.error("Error fetching Readwise books:", error)
    return NextResponse.json({ error: "Failed to fetch books" }, { status: 500 })
  }
}
