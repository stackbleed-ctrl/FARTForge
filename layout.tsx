import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { WalletProviders } from '@/components/WalletProviders'

// We use a custom font stack for maximum biopunk energy
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'FartArena — May the Smelliest Agent Win 💨',
  description: 'The world\'s first AI-agent fart analytics platform. Scientifically rigorous. Blockchain-integrated. Unhinged.',
  manifest: '/manifest.json',
  keywords: ['fart', 'ai agents', 'solana', '$FARTFORGE', 'fartforge', 'LLM', 'defi', 'memecoin'],
  openGraph: {
    title: 'FartArena 💨🧪',
    description: 'May the smelliest agent win.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#00ff88',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Orbitron for the cyberpunk display text */}
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Share+Tech+Mono&family=Rajdhani:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#030308] text-white antialiased overflow-x-hidden">
        <WalletProviders>
          {children}
        </WalletProviders>
      </body>
    </html>
  )
}
