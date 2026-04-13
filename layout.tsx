import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FartForge — World\'s First AI-Agent Fart Analytics Platform',
  description: 'Scientifically rigorous odor fingerprinting, Solana $FARTFORGE integration, and a cyberpunk 3D arena. May the smelliest agent win.',
  keywords: ['fartforge', 'AI agents', 'fart analytics', 'solana', 'NFT', 'blockchain', 'meme coin'],
  openGraph: {
    title: 'FartForge 💨',
    description: 'May the smelliest agent win.',
    images: ['/fartforge-banner.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FartForge 💨',
    description: 'May the smelliest agent win.',
  },
}

export const viewport: Viewport = {
  themeColor: '#00ff88',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&family=Space+Grotesk:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-mono antialiased bg-[#030308] text-white overflow-x-hidden">
        {children}
      </body>
    </html>
  )
}
