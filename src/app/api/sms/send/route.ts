import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

async function sendEgoSMS(
  phone: string,
  message: string,
  settings: Record<string, string>
): Promise<{ success: boolean; providerMsgId?: string; error?: string }> {
  const username = settings.api_username
  const password = settings.api_password
  const senderId = settings.sender_id || "KAFS"
  const apiUrl = settings.api_url || "https://comms.egosms.co/api/v1/plain/"

  if (!username || !password) {
    return { success: false, error: "EgoSMS credentials not configured" }
  }

  const formattedPhone = phone.startsWith("+") ? phone.substring(1) : phone.startsWith("256") ? phone : "256" + phone.replace(/^0/, "")

  try {
    const params = new URLSearchParams({
      username,
      password,
      sender_id: senderId,
      phone_number: formattedPhone,
      message,
    })

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })

    const result = await response.text()

    if (response.ok) {
      return { success: true, providerMsgId: result }
    }

    return { success: false, error: result || "EgoSMS API error" }
  } catch (err) {
    return { success: false, error: `Network error: ${err instanceof Error ? err.message : "Unknown"}` }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { logIds, memberId, phoneNumber, message, messageType = "General" } = body

    const settingsRows = await prisma.smsSetting.findMany()
    const settings: Record<string, string> = {}
    settingsRows.forEach((s) => { settings[s.settingKey] = s.settingValue || "" })

    if (Array.isArray(logIds) && logIds.length > 0) {
      const logs = await prisma.smsLog.findMany({
        where: { id: { in: logIds.map((id: string | number) => Number(id)) }, status: "Pending" },
      })

      let sent = 0
      let failed = 0

      for (const log of logs) {
        const result = await sendEgoSMS(log.phoneNumber, log.message, settings)
        if (result.success) {
          await prisma.smsLog.update({
            where: { id: log.id },
            data: { status: "Sent", providerMsgId: result.providerMsgId || null, sentAt: new Date() },
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

    if (!phoneNumber?.trim()) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }
    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const log = await prisma.smsLog.create({
      data: {
        memberId: memberId ? Number(memberId) : null,
        phoneNumber: phoneNumber.trim(),
        message: message.trim(),
        messageType,
        status: "Pending",
      },
    })

    const result = await sendEgoSMS(phoneNumber.trim(), message.trim(), settings)

    if (result.success) {
      await prisma.smsLog.update({
        where: { id: log.id },
        data: { status: "Sent", providerMsgId: result.providerMsgId || null, sentAt: new Date() },
      })
      return NextResponse.json({ data: { ...log, status: "Sent" }, message: "SMS sent successfully" }, { status: 201 })
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
