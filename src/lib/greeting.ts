"use client"

/**
 * Time-of-day greeting used in the header and on the dashboard.
 *
 * Boundaries are in the SACCO's timezone (Africa/Kampala), the same one the SMS
 * templates use:
 *   05:00 - 11:59  Good morning
 *   12:00 - 17:59  Good afternoon
 *   18:00 - 04:59  Good evening
 */

import { useEffect, useState } from "react"

export type TimeOfDay = "morning" | "afternoon" | "evening"

/** Returns the current part of the day. */
export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kampala",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24

  if (hour >= 5 && hour < 12) return "morning"
  if (hour >= 12 && hour < 18) return "afternoon"
  return "evening"
}

/** "Good morning" / "Good afternoon" / "Good evening" */
export function greetingPhrase(date: Date = new Date()): string {
  const label = getTimeOfDay(date)
  return `Good ${label.charAt(0).toUpperCase()}${label.slice(1)}`
}

/** "Good morning, Syrus" — just the phrase when no name is set. */
export function greetingFor(fullName?: string | null, date: Date = new Date()): string {
  const name = (fullName || "").trim()
  if (!name) return greetingPhrase(date)
  return `${greetingPhrase(date)}, ${name}`
}

/**
 * The greeting, kept current so an app left open all day still shows the right
 * part of the day. Starts empty so server HTML and the first client render
 * always match.
 */
export function useGreeting(fullName?: string | null): string {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  return now ? greetingFor(fullName, now) : ""
}
