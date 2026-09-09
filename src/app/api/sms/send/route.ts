import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

interface EgoSMSResponse {
  status?: number
  message?: string
  data?: { id?: string }
}

async function sendEgoSMS(
  phone: string,
  message: string,
  settings: Record<string, string>
): Promise<{ success: boolean; providerMsgId?: string; error?: string }> {
  const apiKey = settings.api_key
  const apiSecret = settings.api_secret
  const senderId = settings.sender_id || "KAFSSACCO"
  const baseUrl = settings.base_url || "https://app.egosms.co/api/v1"

  if (!apiKey || !apiSecret) {
    return { success: false, error: "EgoSMS API credentials not configured" }
  }

  try {
    const response = await fetch(`${baseUrl}/sms/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        sender_id: senderId,
        phone_number: phone.replace(/^0/, "256"),
        message,
      }),
    })

    const result: EgoSMSResponse = await response.json()

    if (response.ok && result.status === 200) {
      return { success: true, providerMsgId: result.data?.id }
    }

    return { success: false, error: result.message || "EgoSMS API error" }
  } catch (err) {
    return { success: false, error: `Network error: ${err instanceof Error ? err.message : "Unknown"}` }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { logIds, memberId, phoneNumber, message, messageType = "General" } = body

    // Bulk send
    if (Array.isArray(logIds) && logIds.length > 0) {
      const logs = await prisma.smsLog.findMany({
        where: { id: { in: logIds.map((id: string | number) => Number(id)) }, status: "Pending" },
      })

      const settingsRows = await prisma.smsSetting.findMany()
      const settings: Record<string, string> = {}
      settingsRows.forEach((s) => { settings[s.settingKey] = s.settingValue || "" })

      let sent = 0
      let failed = 0

      for (const log of logs) {
        const result = await sendEgoSMS(log.phoneNumber, log.message, settings)
        if (result.success) {
          await prisma.smsLog.update({
            where: { id: log.id },
            data: {
              status: "Sent",
              providerMsgId: result.providerMsgId || null,
              sentAt: new Date(),
            },
          })
          sent++
        } else {
          await prisma.smsLog.update({
            where: { id: log.id },
            data: { status: "Failed", errorMessage: result.error || "Send failed" },
          })
          failed++
        }
      }

      return NextResponse.json({ message: `Sent: ${sent}, Failed: ${failed}`, sent, failed })
    }

    // Single send
    if (!phoneNumber?.trim()) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }
    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const log = await prisma.smsLog.create({
      data: {
        memberId: memberId ? parseInt(memberId) : null,
        phoneNumber: phoneNumber.trim(),
        message: message.trim(),
        messageType,
        status: "Pending",
      },
    })

    const settingsRows = await prisma.smsSetting.findMany()
    const settings: Record<string, string> = {}
    settingsRows.forEach((s) => { settings[s.settingKey] = s.settingValue || "" })

    const result = await sendEgoSMS(phoneNumber.trim(), message.trim(), settings)

    if (result.success) {
      await prisma.smsLog.update({
        where: { id: log.id },
        data: {
          status: "Sent",
          providerMsgId: result.providerMsgId || null,
          sentAt: new Date(),
        },
      })
      return NextResponse.json({ data: { ...log, status: "Sent" }, message: "SMS sent" }, { status: 201 })
    }

    await prisma.smsLog.update({
      where: { id: log.id },
      data: { status: "Failed", errorMessage: result.error || "Send failed" },
    })

    return NextResponse.json(
      { data: { ...log, status: "Failed" }, message: "SMS failed", error: result.error },
      { status: 502 }
    )
  } catch (error) {
    console.error("POST /api/sms/send error:", error)
    return NextResponse.json({ error: "Failed to send SMS" }, { status: 500 })
  }
}
