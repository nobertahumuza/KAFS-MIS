"use client"

import { useEffect, useState } from "react"

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  life: number
  decay: number
}

const COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#FF9FF3", "#54A0FF", "#5F27CD", "#01A3A4"]

function createBurst(cx: number, cy: number): Particle[] {
  const particles: Particle[] = []
  const count = 40 + Math.floor(Math.random() * 30)
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
    const speed = 2 + Math.random() * 6
    particles.push({
      id: Date.now() + i,
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 2 + Math.random() * 4,
      life: 1,
      decay: 0.01 + Math.random() * 0.02,
    })
  }
  return particles
}

export default function Fireworks({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    if (!active) { setParticles([]); return }

    const bursts: Particle[] = []
    const w = window.innerWidth
    const h = window.innerHeight

    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const newParticles = createBurst(
          w * 0.2 + Math.random() * w * 0.6,
          h * 0.2 + Math.random() * h * 0.5
        )
        setParticles((prev) => [...prev, ...newParticles])
      }, i * 400)
    }

    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.08,
            vx: p.vx * 0.98,
            life: p.life - p.decay,
            size: p.size * 0.97,
          }))
          .filter((p) => p.life > 0)
      )
    }, 16)

    return () => clearInterval(interval)
  }, [active])

  if (!active || particles.length === 0) return null

  return (
    <div className="fixed inset-0 z-[300] pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            opacity: p.life,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  )
}
