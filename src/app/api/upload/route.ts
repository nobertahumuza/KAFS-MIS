import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { isRemoteStorageConfigured, uploadDocument } from "@/lib/storage"

// Vercel caps request bodies at ~4.5 MB, so anything larger can never reach
// the storage layer - reject it with a clear message instead of a 500.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 4 MB." },
        { status: 413 }
      )
    }

    const bytes = Buffer.from(await file.arrayBuffer())

    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const fileName = `${timestamp}-${safeName}`

    let fileUrl: string

    if (isRemoteStorageConfigured()) {
      // S3-compatible object storage (R2 / B2 / S3) - persists across deploys
      // and is included in the nightly database+files backup story.
      const uploaded = await uploadDocument({
        fileName,
        buffer: bytes,
        contentType: file.type || "application/octet-stream",
      })
      fileUrl = uploaded.url
    } else if (process.env.NODE_ENV !== "production") {
      // Local development fallback only: Vercel's filesystem is read-only
      // and ephemeral, so this would silently lose files in production.
      const uploadsDir = path.join(process.cwd(), "public", "uploads")
      await mkdir(uploadsDir, { recursive: true })
      const filePath = path.join(uploadsDir, fileName)
      await writeFile(filePath, bytes)
      fileUrl = `/uploads/${fileName}`
    } else {
      return NextResponse.json(
        {
          error:
            "File storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY (see docs/BACKUP.md).",
        },
        { status: 503 }
      )
    }

    return NextResponse.json({
      message: "File uploaded successfully",
      url: fileUrl,
      fileName,
      fileSize: file.size,
      mimeType: file.type,
    })
  } catch (error) {
    console.error("POST /api/upload error:", error)
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    )
  }
}
