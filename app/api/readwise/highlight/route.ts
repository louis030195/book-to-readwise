import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const readwiseToken = process.env.READWISE_ACCESS_TOKEN

  if (!readwiseToken) {
    return NextResponse.json({ error: "Readwise token not configured" }, { status: 500 })
  }

  try {
    const { text, book, note, source } = await request.json()

    // Parse book title and author
    const bookParts = book.split(" by ")
    const title = bookParts[0]
    const author = bookParts[1] || "Unknown Author"

    const highlightData = {
      highlights: [
        {
          text: text,
          title: title,
          author: author,
          note: note || undefined,
          source_type: "photo",
          source_url: source,
          highlighted_at: new Date().toISOString(),
        },
      ],
    }

    const response = await fetch("https://readwise.io/api/v2/highlights/", {
      method: "POST",
      headers: {
        Authorization: `Token ${readwiseToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(highlightData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Readwise API error: ${JSON.stringify(errorData)}`)
    }

    const result = await response.json()
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("Error creating Readwise highlight:", error)
    return NextResponse.json({ error: "Failed to create highlight" }, { status: 500 })
  }
}
