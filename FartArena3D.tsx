'use client'

import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Sphere, Torus, Float, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'
import type { EmitResult } from '@/lib/types'

interface Props {
  emitResult: EmitResult | null
  isEmitting: boolean
  walletTier: 0 | 1 | 2 | 3
  particleDensity: number
}

// ── Gas Particle System ────────────────────────────────────────────────────
function GasParticles({
  count,
  isEmitting,
  rumbleScore,
  sharpnessScore,
  color = '#00ff88',
  secondaryColor = '#ffd700',
}: {
  count: number
  isEmitting: boolean
  rumbleScore: number
  sharpnessScore: number
  color?: string
  secondaryColor?: string
}) {
  const meshRef = useRef<THREE.Points>(null!)
  const clockRef = useRef(0)

  const [positions, velocities, lifetimes, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    const life = new Float32Array(count)
    const sz = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Start at reactor center with slight random offset
      pos[i * 3 + 0] = (Math.random() - 0.5) * 0.4
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.4
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4

      // Upward drift with horizontal spread
      vel[i * 3 + 0] = (Math.random() - 0.5) * 0.02
      vel[i * 3 + 1] = 0.01 + Math.random() * 0.04
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.02

      life[i] = Math.random()  // 0–1 lifecycle
      sz[i] = 0.02 + Math.random() * 0.08
    }

    return [pos, vel, life, sz]
  }, [count])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions.slice(), 3))
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
    return geo
  }, [positions, sizes])

  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 0.06,
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  }, [color])

  useFrame((_, delta) => {
    if (!meshRef.current || !isEmitting) return

    clockRef.current += delta
    const posAttr = meshRef.current.geometry.getAttribute('position') as THREE.BufferAttribute
    const posArray = posAttr.array as Float32Array

    // Rumble = slow massive clouds, sharp = rapid sulfur sparks
    const speed = isEmitting ? (0.5 + sharpnessScore * 2.0) : 0.1
    const turbulence = rumbleScore * 0.03

    for (let i = 0; i < count; i++) {
      life[i] += delta * speed * (0.3 + Math.random() * 0.4)

      if (life[i] > 1.0) {
        // Reset particle to origin
        posArray[i * 3 + 0] = (Math.random() - 0.5) * 0.4
        posArray[i * 3 + 1] = (Math.random() - 0.5) * 0.2 - 0.5
        posArray[i * 3 + 2] = (Math.random() - 0.5) * 0.4
        velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.03
        velocities[i * 3 + 1] = 0.015 + Math.random() * 0.05
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.03
        life[i] = 0
      }

      // Move particle
      posArray[i * 3 + 0] += velocities[i * 3 + 0] * speed
        + Math.sin(clockRef.current * 2 + i) * turbulence
      posArray[i * 3 + 1] += velocities[i * 3 + 1] * speed
      posArray[i * 3 + 2] += velocities[i * 3 + 2] * speed
        + Math.cos(clockRef.current * 1.5 + i) * turbulence

      // Fade out as life increases
      material.opacity = Math.max(0.1, 0.7 * (1 - life[i]))
    }

    posAttr.needsUpdate = true
  })

  return <points ref={meshRef} geometry={geometry} material={material} />
}

// ── Butt Reactor (the star of the show) ───────────────────────────────────
function ButtReactor({ isEmitting, stinkScore, walletTier }: {
  isEmitting: boolean
  stinkScore: number
  walletTier: number
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const glowRef = useRef<THREE.Mesh>(null!)
  const ringRef = useRef<THREE.Mesh>(null!)

  const tierColors = ['#00ff88', '#00ff88', '#ff00ff', '#ff0044']
  const color = tierColors[walletTier] || '#00ff88'

  useFrame(state => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime

    // Gentle float + subtle rotation
    groupRef.current.position.y = Math.sin(t * 0.8) * 0.08
    groupRef.current.rotation.y = t * 0.3

    // Pulse on emit
    const scale = isEmitting
      ? 1.0 + Math.sin(t * 20) * 0.08 + stinkScore * 0.01
      : 1.0 + Math.sin(t * 1.5) * 0.02

    groupRef.current.scale.setScalar(scale)

    // Ring rotation
    if (ringRef.current) {
      ringRef.current.rotation.x = t * 0.5
      ringRef.current.rotation.z = t * 0.3
    }

    // Glow intensity
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = isEmitting
        ? 2 + Math.sin(t * 15) * 1.5
        : 0.5 + Math.sin(t * 2) * 0.3
    }
  })

  return (
    <group ref={groupRef}>
      {/* Core reactor sphere */}
      <Sphere args={[0.6, 64, 64]} ref={glowRef}>
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isEmitting ? 2 : 0.5}
          distort={isEmitting ? 0.4 : 0.15}
          speed={isEmitting ? 8 : 2}
          transparent
          opacity={0.85}
          roughness={0.1}
          metalness={0.8}
        />
      </Sphere>

      {/* Orbital ring */}
      <Torus ref={ringRef} args={[0.9, 0.03, 16, 100]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1}
          transparent
          opacity={0.6}
        />
      </Torus>

      {/* Second orbital ring (perpendicular) */}
      <Torus args={[1.1, 0.02, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color="#ff00ff"
          emissive="#ff00ff"
          emissiveIntensity={0.8}
          transparent
          opacity={0.4}
        />
      </Torus>

      {/* Glow halo */}
      <Sphere args={[0.75, 32, 32]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Point light for scene illumination */}
      <pointLight
        color={color}
        intensity={isEmitting ? 8 : 2}
        distance={8}
        decay={2}
      />
    </group>
  )
}

// ── Ambient Floating Particles (background atmosphere) ────────────────────
function AmbientParticles({ count = 200 }: { count?: number }) {
  const points = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 12
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 3
    }
    return positions
  }, [count])

  const ref = useRef<THREE.Points>(null!)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.02
    }
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.015}
        color="#00ff88"
        transparent
        opacity={0.3}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// ── Scene Wrapper ─────────────────────────────────────────────────────────
function Scene({ emitResult, isEmitting, walletTier, particleDensity }: Props) {
  const rumbleScore = emitResult?.fingerprint?.rumble_score ?? 0.5
  const sharpnessScore = emitResult?.fingerprint?.sharpness_score ?? 0.3
  const stinkScore = emitResult?.stink_score ?? 0

  const particleCount = Math.floor(300 * particleDensity * (1 + walletTier * 0.5))

  // Tier-based particle colors
  const tierParticleColors: [string, string][] = [
    ['#00ff88', '#ffd700'],
    ['#00ff88', '#ffd700'],
    ['#ff00ff', '#8b00ff'],
    ['#ff0044', '#ff8800'],
  ]
  const [primaryColor, secondaryColor] = tierParticleColors[walletTier]

  return (
    <>
      {/* Fog for atmosphere */}
      <fog attach="fog" args={['#030308', 8, 20]} />

      {/* Ambient light */}
      <ambientLight intensity={0.1} />

      {/* Directional light */}
      <directionalLight position={[5, 5, 5]} intensity={0.3} color="#8b00ff" />

      {/* The star: Butt Reactor */}
      <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
        <ButtReactor
          isEmitting={isEmitting}
          stinkScore={stinkScore}
          walletTier={walletTier}
        />
      </Float>

      {/* Gas particle system */}
      <GasParticles
        count={particleCount}
        isEmitting={isEmitting}
        rumbleScore={rumbleScore}
        sharpnessScore={sharpnessScore}
        color={primaryColor}
        secondaryColor={secondaryColor}
      />

      {/* Ambient background particles */}
      <AmbientParticles count={150} />

      {/* Orbit controls (touch-friendly) */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={!isEmitting}
        autoRotateSpeed={0.5}
        maxPolarAngle={Math.PI * 0.7}
        minPolarAngle={Math.PI * 0.3}
      />
    </>
  )
}

// ── Main Export ───────────────────────────────────────────────────────────
export default function FartArena3D({ emitResult, isEmitting, walletTier, particleDensity }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4], fov: 60 }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      style={{ background: 'transparent' }}
    >
      <Scene
        emitResult={emitResult}
        isEmitting={isEmitting}
        walletTier={walletTier}
        particleDensity={particleDensity}
      />
    </Canvas>
  )
}
