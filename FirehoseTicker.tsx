'use client'

import { useEffect, useState, useRef } from 'react'
import type { FirehoseTweet } from '@/lib/types'

export function FirehoseTicker() {
  const [tweets, setTweets] = useState<FirehoseTweet[]>([])
  const [source, setSource] = useState<string>('')

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch('/api/firehose?limit=12')
        const data = await res.json()
        setTweets(data.tweets ?? [])
        setSource(data.source ?? '')
      } catch { /* keep existing */ }
    }
    fetch_()
    const interval = setInterval(fetch_, 30_000)
    return () => clearInterval(interval)
  }, [])

  if (tweets.length === 0) return null

  // Double the array so the marquee loops seamlessly
  const doubled = [...tweets, ...tweets]

  return (
    <div className="fixed top-14 inset-x-0 z-40 h-7 overflow-hidden bg-black/40 backdrop-blur-sm border-b border-white/[0.04]">
      {/* Source badge */}
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 bg-[#030308]/90 border-r border-white/10">
        <span className="font-display text-[8px] uppercase tracking-widest text-[#00ff88]">
          {source === 'twitter' ? '𝕏 Live' : source === 'supabase' ? '⚡ Live' : '📡 Feed'}
        </span>
      </div>

      {/* Scrolling content */}
      <div className="flex items-center h-full ml-16">
        <div
          className="flex gap-8 shrink-0"
          style={{
            animation: 'ticker-scroll 60s linear infinite',
            willChange: 'transform',
          }}
        >
          {doubled.map((tweet, i) => (
            <span
              key={`${tweet.id}-${i}`}
              className="whitespace-nowrap font-mono text-[10px] text-white/35 flex items-center gap-2"
            >
              <span className="text-[#00ff8840]">@{tweet.username}</span>
              <span>{tweet.text}</span>
              <span className="text-white/15">{tweet.timestamp}</span>
              <span className="text-[#00ff8820]">·</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
