import { type NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"

const extractedTextSchema = z.object({
  fullText: z.string().describe("The complete text extracted from the image"),
  confidence: z.number().min(0).max(1).describe("Confidence level of the text extraction"),
  isBookContent: z.boolean().describe("Whether this appears to be content from a book"),
  suggestedBookTitle: z.string().optional().describe("Suggested book title if detectable"),
  suggestedAuthor: z.string().optional().describe("Suggested author if detectable"),
})

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 })
    }

    const result = await generateObject({
      model: google("gemini-1.5-pro-latest"),
      schema: extractedTextSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this image. If this appears to be from a book, try to identify the book title and author. Provide a confidence score for the text extraction quality. Be very accurate with the text extraction and maintain original formatting where possible.",
            },
            {
              type: "image",
              image: imageUrl,
            },
          ],
        },
      ],
    })

    return NextResponse.json(result.object)
  } catch (error) {
    console.error("Error extracting text:", error)
    return NextResponse.json({ error: "Failed to extract text" }, { status: 500 })
  }
}
