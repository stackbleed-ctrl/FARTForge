'use client'

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, Sphere, MeshDistortMaterial, Stars } from '@react-three/drei'
import * as THREE from 'three'
import type { EmitResult, WalletTier } from '@/lib/types'

// ── Particle cloud ────────────────────────────────────────────────────────────

interface ParticleCloudProps {
  count: number
  color: string
  speed: number
  spread: number
  size: number
  active: boolean
}

function ParticleCloud({ count, color, speed, spread, size, active }: ParticleCloudProps) {
  const ref = useRef<THREE.Points>(null)
  const timeRef = useRef(0)

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * spread
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.5
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread
      vel[i * 3]     = (Math.random() - 0.5) * 0.01
      vel[i * 3 + 1] = Math.random() * 0.02 * speed
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.01
    }
    return [pos, vel]
  }, [count, spread, speed])

  useFrame((_, delta) => {
    if (!ref.current || !active) return
    timeRef.current += delta
    const pos = ref.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < count; i++) {
      pos[i * 3]     += velocities[i * 3]     * speed
      pos[i * 3 + 1] += velocities[i * 3 + 1] * speed
      pos[i * 3 + 2] += velocities[i * 3 + 2] * speed
      // Reset particles that drift too far
      if (Math.abs(pos[i * 3 + 1]) > spread) {
        pos[i * 3]     = (Math.random() - 0.5) * spread * 0.2
        pos[i * 3 + 1] = -spread * 0.5
        pos[i * 3 + 2] = (Math.random() - 0.5) * spread * 0.2
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true
    ref.current.rotation.y += delta * 0.05
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        transparent
        opacity={active ? 0.7 : 0.15}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// ── Central butt reactor sphere ───────────────────────────────────────────────

interface ReactorProps {
  isEmitting: boolean
  stinkScore: number
  walletTier: WalletTier
}

function ButtReactor({ isEmitting, stinkScore, walletTier }: ReactorProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const intensity = stinkScore / 10

  const tierColor = ['#00ff88', '#00aaff', '#aa00ff', '#ff2244'][walletTier]

  useFrame((state) => {
    if (!meshRef.current || !glowRef.current) return
    const t = state.clock.elapsedTime
    const pulse = isEmitting ? 1 + Math.sin(t * 12) * 0.08 : 1 + Math.sin(t * 1.5) * 0.02
    meshRef.current.scale.setScalar(pulse)
    glowRef.current.scale.setScalar(pulse * (1.3 + intensity * 0.4))
    glowRef.current.rotation.y = t * 0.3
    glowRef.current.rotation.z = t * 0.15
  })

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.4}>
      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial
          color={isEmitting ? '#00ff88' : tierColor}
          transparent
          opacity={isEmitting ? 0.06 + intensity * 0.04 : 0.03}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Core reactor */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial
          color={isEmitting ? '#00ff88' : '#003322'}
          emissive={isEmitting ? '#00ff44' : tierColor}
          emissiveIntensity={isEmitting ? 0.6 + intensity * 0.4 : 0.1}
          distort={isEmitting ? 0.3 + intensity * 0.2 : 0.05}
          speed={isEmitting ? 4 : 1}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Ring accent */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.4, 0.02, 8, 64]} />
        <meshBasicMaterial
          color={tierColor}
          transparent
          opacity={isEmitting ? 0.8 : 0.3}
        />
      </mesh>
    </Float>
  )
}

// ── Scene wrapper ─────────────────────────────────────────────────────────────

interface SceneProps {
  emitResult: EmitResult | null
  isEmitting: boolean
  walletTier: WalletTier
  particleDensity: number
}

function Scene({ emitResult, isEmitting, walletTier, particleDensity }: SceneProps) {
  const stinkScore = emitResult?.stink_score ?? 0
  const fingerprint = emitResult?.fingerprint
  const rumble = fingerprint?.rumble_score ?? 0.5
  const sharpness = fingerprint?.sharpness_score ?? 0.3

  const particleCount = Math.floor(200 * particleDensity * (1 + stinkScore / 10))

  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 5, 0]} intensity={isEmitting ? 2 : 0.5} color="#00ff88" />
      <pointLight position={[-5, -2, 3]} intensity={0.3} color="#8b00ff" />
      <pointLight position={[5, -2, -3]} intensity={0.3} color="#ff6600" />

      <Stars radius={80} depth={50} count={1500} factor={3} fade speed={0.5} />

      {/* Gas particle clouds */}
      <ParticleCloud
        count={particleCount}
        color="#00ff88"
        speed={isEmitting ? 0.8 + rumble : 0.1}
        spread={8}
        size={0.04}
        active={isEmitting || stinkScore > 0}
      />
      <ParticleCloud
        count={Math.floor(particleCount * 0.5)}
        color="#ffcc00"
        speed={isEmitting ? 0.5 + sharpness : 0.05}
        spread={5}
        size={0.02}
        active={isEmitting && stinkScore > 5}
      />
      {walletTier >= 2 && (
        <ParticleCloud
          count={Math.floor(particleCount * 0.3)}
          color="#8b00ff"
          speed={isEmitting ? 1.2 : 0.08}
          spread={10}
          size={0.03}
          active={isEmitting}
        />
      )}

      <ButtReactor isEmitting={isEmitting} stinkScore={stinkScore} walletTier={walletTier} />
    </>
  )
}

// ── Public component ──────────────────────────────────────────────────────────

interface FartArena3DProps {
  emitResult: EmitResult | null
  isEmitting: boolean
  walletTier: WalletTier
  particleDensity: number
}

export default function FartArena3D({ emitResult, isEmitting, walletTier, particleDensity }: FartArena3DProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 60 }}
      gl={{ antialias: true, alpha: true }}
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
