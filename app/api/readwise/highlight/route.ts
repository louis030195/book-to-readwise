import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const readwiseToken = process.env.READWISE_ACCESS_TOKEN;

  if (!readwiseToken) {
    return NextResponse.json(
      { error: "Readwise token not configured" },
      { status: 500 }
    );
  }

  try {
    const { text, book_id, title, author, note, source, tags } =
      await request.json();

    console.log("Received highlight data:", {
      text: text?.substring(0, 100) + "...",
      book_id,
      title,
      author,
      note,
      source,
      tags,
      tagsType: typeof tags,
      tagsLength: tags?.length,
    });

    // If we have a book_id, it means the user selected an existing book
    // We need to fetch the exact title and author from that book to ensure proper matching
    let finalTitle = title;
    let finalAuthor = author || "Unknown Author";
    let finalSourceType = "photo_extractor"; // Our app's source name
    let finalSourceUrl = source; // The URL from our app (image filename)

    if (book_id) {
      try {
        console.log("Fetching exact book details for book_id:", book_id);
        const bookResponse = await fetch(
          `https://readwise.io/api/v2/books/${book_id}/`,
          {
            headers: {
              Authorization: `Token ${readwiseToken}`,
            },
          }
        );

        if (bookResponse.ok) {
          const bookData = await bookResponse.json();
          // Use the EXACT details from Readwise to ensure perfect matching
          finalTitle = bookData.title;
          finalAuthor = bookData.author;
          finalSourceType = bookData.source; // Use existing book's source
          finalSourceUrl = bookData.source_url; // Use existing book's source_url

          console.log("Using exact book details:", {
            originalTitle: title,
            finalTitle,
            originalAuthor: author,
            finalAuthor,
            titleMatch: title === finalTitle,
            authorMatch: author === finalAuthor,
            titleLength: finalTitle.length,
            authorLength: finalAuthor.length,
            bookDataId: bookData.id,
            finalSourceType,
            finalSourceUrl,
          });
        } else {
          console.warn(
            "Failed to fetch book details, using provided title/author"
          );
        }
      } catch (error) {
        console.error("Error fetching book details:", error);
        // Continue with provided title/author if fetch fails
      }
    }

    // Handle tags using Readwise's inline tagging functionality
    let finalNote = note || "";
    if (tags && tags.length > 0) {
      // Filter out empty tags and format properly
      const validTags = tags.filter((tag: string) => tag && tag.trim());
      if (validTags.length > 0) {
        // Use inline tagging format with dots for proper tag recognition in Readwise
        const tagString = validTags
          .map((tag: string) => `.${tag.trim().replace(/\s+/g, "-")}`)
          .join(" ");
        finalNote = finalNote ? `${finalNote}\n\n${tagString}` : tagString;
      }
    }

    let highlightData: any = {
      text: text,
      note: finalNote || undefined,
      source_type: finalSourceType,
      source_url: finalSourceUrl,
      highlighted_at: new Date().toISOString(),
      title: finalTitle, // Use exact title from Readwise
      author: finalAuthor, // Use exact author from Readwise
      category: "books", // Explicitly set category to books
      location_type: "order", // Set location type
    };

    console.log("Sending to Readwise API:", {
      ...highlightData,
      notePreview: highlightData.note?.substring(0, 200) + "...",
    });

    const response = await fetch("https://readwise.io/api/v2/highlights/", {
      method: "POST",
      headers: {
        Authorization: `Token ${readwiseToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ highlights: [highlightData] }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Readwise API error: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    console.log("Readwise API response:", result);

    // The API returns the book information in the response array
    const bookId = result[0]?.id;
    console.log("Extracted book ID:", bookId);

    return NextResponse.json({ success: true, bookId });
  } catch (error) {
    console.error("Error creating Readwise highlight:", error);
    return NextResponse.json(
      { error: "Failed to create highlight" },
      { status: 500 }
    );
  }
}
