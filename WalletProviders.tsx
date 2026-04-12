'use client'

import { useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import '@solana/wallet-adapter-react-ui/styles.css'

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC ?? clusterApiUrl('mainnet-beta')

// $FARTFORGE token mint address
export const FART_TOKEN_MINT = process.env.NEXT_PUBLIC_FART_TOKEN_MINT ?? '5Rc86umhtn3UwBqDzexhpkZkeStifJt2sBG6Aj1Spump'

export function WalletProviders({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], [])

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
