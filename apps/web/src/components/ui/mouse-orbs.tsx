'use client'

import { useEffect } from 'react'
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'framer-motion'

interface OrbConfig {
  color: string
  size: number
  stiffness: number
  damping: number
  offsetX: number
  offsetY: number
  opacity: number
}

const ORBS: OrbConfig[] = [
  { color: '#6B48FF', size: 750, stiffness: 22, damping: 20, offsetX: -280, offsetY: -220, opacity: 0.22 },
  { color: '#FF6B8A', size: 620, stiffness: 13, damping: 16, offsetX: 240, offsetY: 200, opacity: 0.16 },
  { color: '#4F8EFF', size: 520, stiffness: 38, damping: 24, offsetX: -60, offsetY: 310, opacity: 0.13 },
]

function Orb({
  config,
  mouseX,
  mouseY,
}: {
  config: OrbConfig
  mouseX: MotionValue<number>
  mouseY: MotionValue<number>
}) {
  const springX = useSpring(mouseX, { stiffness: config.stiffness, damping: config.damping })
  const springY = useSpring(mouseY, { stiffness: config.stiffness, damping: config.damping })

  const x = useTransform(springX, (v) => v + config.offsetX - config.size / 2)
  const y = useTransform(springY, (v) => v + config.offsetY - config.size / 2)

  return (
    <motion.div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        x,
        y,
        width: config.size,
        height: config.size,
        background: `radial-gradient(circle at center, ${config.color} 0%, transparent 70%)`,
        borderRadius: '50%',
        opacity: config.opacity,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}

export function MouseOrbs() {
  const mouseX = useMotionValue(typeof window !== 'undefined' ? window.innerWidth / 2 : 600)
  const mouseY = useMotionValue(typeof window !== 'undefined' ? window.innerHeight / 2 : 400)

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
    }
    window.addEventListener('mousemove', handle)
    return () => window.removeEventListener('mousemove', handle)
  }, [mouseX, mouseY])

  return (
    <>
      {ORBS.map((orb, i) => (
        <Orb key={i} config={orb} mouseX={mouseX} mouseY={mouseY} />
      ))}
    </>
  )
}
