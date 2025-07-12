import { type NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { cookies } from "next/headers";

const extractedTextSchema = z.object({
  fullText: z.string().describe("The complete text extracted from the image"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence level of the text extraction"),
  isBookContent: z
    .boolean()
    .describe("Whether this appears to be content from a book"),
  suggestedBookTitle: z
    .string()
    .optional()
    .describe("Suggested book title if detectable"),
  suggestedAuthor: z
    .string()
    .optional()
    .describe("Suggested author if detectable"),
  tags: z
    .array(z.string())
    .optional()
    .describe(
      "A list of 3-5 relevant, concise tags (e.g., 'decision-making', 'philosophy', 'mental-models')."
    ),
});

// Simple in-memory cache to prevent duplicate requests
const processingCache = new Map<string, Promise<any>>();

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    console.log("Processing image URL:", imageUrl);

    // Check if we're already processing this image
    if (processingCache.has(imageUrl)) {
      console.log("Request already in progress for this image, waiting...");
      const cachedResult = await processingCache.get(imageUrl);
      return NextResponse.json(cachedResult);
    }

    // Get the user's access token for authenticated requests
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("google_access_token")?.value;

    // Fetch recent Readwise books to help with book identification
    let recentBooks = [];
    try {
      const readwiseToken = process.env.READWISE_ACCESS_TOKEN;
      if (readwiseToken) {
        const booksResponse = await fetch(
          "https://readwise.io/api/v2/books/?page_size=50",
          {
            headers: {
              Authorization: `Token ${readwiseToken}`,
            },
          }
        );
        if (booksResponse.ok) {
          const booksData = await booksResponse.json();
          recentBooks = booksData.results.map((book: any) => ({
            title: book.title,
            author: book.author,
            id: book.id,
          }));
          console.log(
            "Fetched",
            recentBooks.length,
            "recent books from Readwise"
          );
        }
      }
    } catch (error) {
      console.error("Error fetching Readwise books:", error);
      // Continue without recent books if fetch fails
    }

    let imageToProcess = imageUrl;

    // If this is a Google Photos URL, we need to download it with authentication
    if (imageUrl.includes("googleusercontent.com")) {
      if (!accessToken) {
        return NextResponse.json(
          { error: "Authentication required for Google Photos" },
          { status: 401 }
        );
      }

      try {
        console.log("Downloading image with authentication...");
        const imageResponse = await fetch(imageUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "Mozilla/5.0 (compatible; PhotoTextExtractor/1.0)",
          },
        });

        if (!imageResponse.ok) {
          console.error(
            "Failed to download image:",
            imageResponse.status,
            imageResponse.statusText
          );
          return NextResponse.json(
            {
              error: `Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`,
            },
            { status: 400 }
          );
        }

        // Convert to base64 for AI processing
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString("base64");
        const mimeType =
          imageResponse.headers.get("content-type") || "image/jpeg";
        imageToProcess = `data:${mimeType};base64,${base64Image}`;

        console.log(
          "Image downloaded successfully, size:",
          imageBuffer.byteLength
        );
      } catch (error) {
        console.error("Error downloading image:", error);
        return NextResponse.json(
          { error: "Failed to download image" },
          { status: 500 }
        );
      }
    }

    console.log("Extracting text with AI...");

    // Create a promise for the AI processing and cache it
    const processingPromise = generateObject({
      model: google("gemini-2.5-pro"),
      schema: extractedTextSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are my personal Signal Processor. Your function is to read like I read: with a relentless focus on practical application, executable wisdom, and core principles. You operate according to my core drivers: Truth, Wealth, Longevity, and Love. Your output must be ruthlessly concise and primed for my Readwise.

              Process the attached image of a book page with the following protocol:
              
              1.  **Source Identification:** Identify the book title and author. If uncertain, state it.
                  ${
                    recentBooks.length > 0
                      ? `
                  **IMPORTANT:** Here are my recent Readwise books for reference. If the book matches one of these, use the EXACT title and author as listed:
                  ${recentBooks
                    .map(
                      (book: { title: string; author: string; id: string }) =>
                        `- "${book.title}" by ${book.author}`
                    )
                    .join("\n")}
                  
                  If the book is not in this list, provide your best identification of title and author.`
                      : ""
                  }
              
              2.  **Quote extraction:** Extract the powerful quote with EXACT accuracy that I will store in my Readwise as a highlight/quote from the book.
              
              3.  **Aphorism:** Synthesize the transcription into a single, one liner, high-signal aphorism for my future self, aligned with my personality:

              Louis Beaumont is a mission-driven founder focused on ending death and scaling consciousness through AI native systems, particularly with his company Mediar, which automates legacy Windows workflows. He operates with extreme discipline and a data-driven approach, prioritizing truth, wealth, longevity, love, and a strong belief in the programmability of reality.
                  
              4.  **Tag Generation:** Generate a list of 3-5 relevant, concise tags (e.g., "decision-making", "philosophy", "mental-models").
              
              5. **No quotes or citations:** If there is no clear quote, generate a cheatsheet / card type note for my spaced repetition system. / PKM`,
            },
            {
              type: "image",
              image: imageToProcess,
            },
          ],
        },
      ],
    })
      .then((result) => {
        // Clean up cache after processing
        processingCache.delete(imageUrl);
        return result.object;
      })
      .catch((error) => {
        // Clean up cache on error
        processingCache.delete(imageUrl);
        throw error;
      });

    // Cache the processing promise
    processingCache.set(imageUrl, processingPromise);

    const result = await processingPromise;
    console.log("Text extraction completed successfully");
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error extracting text:", error);
    return NextResponse.json(
      { error: "Failed to extract text" },
      { status: 500 }
    );
  }
}
