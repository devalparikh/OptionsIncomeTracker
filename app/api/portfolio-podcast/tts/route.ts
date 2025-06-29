import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

interface RequestBody {
  text: string
  voice: string
  apiKey: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, voice, apiKey } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is required" },
        { status: 400 }
      )
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text content is required" },
        { status: 400 }
      )
    }

    // Validate voice
    const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
    if (!validVoices.includes(voice)) {
      return NextResponse.json(
        { error: "Invalid voice selection" },
        { status: 400 }
      )
    }

    console.log("Converting text to speech:", {
      textLength: text.length,
      voice: voice,
      estimatedDuration: Math.ceil(text.length / 150) // Rough estimate: 150 words per minute
    })

    const openai = new OpenAI({ apiKey })

    // Convert text to speech using OpenAI TTS
    const mp3 = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: voice as any,
      input: text,
      instructions: "Speak in a professional, engaging tone suitable for a financial news podcast. Use clear pronunciation and natural pacing."
    })

    // Convert the response to a buffer
    const buffer = Buffer.from(await mp3.arrayBuffer())

    // Return the audio as a blob
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=3600" // Cache for 1 hour
      }
    })

  } catch (error) {
    console.error("TTS error:", error)
    
    let errorMessage = "Internal server error"
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
} 