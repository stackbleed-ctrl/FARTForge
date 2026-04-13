'use client'

// FocMintButton.tsx  v2
// Fully wired FOC mint:
//   /api/mint → Arweave upload + unsigned Bubblegum cNFT tx
//   → sign with Phantom/Solflare → broadcast → confirm → receipt

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { VersionedTransaction, Transaction } from '@solana/web3.js'

const SOLSCAN = 'https://solscan.io/tx'

type MintStatus = 'idle' | 'uploading' | 'signing' | 'broadcasting' | 'confirming' | 'success' | 'error'

interface FocReceipt {
  emissionId: string
  audioArweaveUrl: string
  metadataUrl: string
  nftName: string
  txSignature: string | null
  stinkScore: number
  archetype: string
}

interface Props {
  analysis: Record<string, any> | null
  audioBase64: string | null
  emissionId?: string
  onMinted?: (receipt: FocReceipt) => void
}

const STATUS_LABELS: Record<MintStatus, string> = {
  idle:         '⛓️  MINT FART RECEIPT — FART ON CHAIN',
  uploading:    '📡  Uploading to Arweave...',
  signing:      '✍️  Sign in Phantom / Solflare...',
  broadcasting: '📡  Broadcasting to Solana...',
  confirming:   '⏳  Confirming on-chain...',
  success:      '✅  FART RECEIPT MINTED',
  error:        '❌  Failed — tap to retry',
}

export default function FocMintButton({ analysis, audioBase64, emissionId, onMinted }: Props) {
  const { publicKey, signTransaction, connected } = useWallet()
  const { connection } = useConnection()
  const [status,  setStatus]  = useState<MintStatus>('idle')
  const [receipt, setReceipt] = useState<FocReceipt | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  const mint = useCallback(async () => {
    if (!analysis || !connected || !publicKey || !signTransaction) return
    setStatus('uploading')
    setError(null)

    try {
      // 1. Call /api/mint — Arweave upload + build unsigned Bubblegum tx
      const res = await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          ownerAddress: publicKey.toBase58(),
          audioBase64:  audioBase64 ?? undefined,
          emissionId,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server error ${res.status}`)
      }
      const data = await res.json()

      const partial: FocReceipt = {
        emissionId:     data.emission_id,
        audioArweaveUrl:data.audio_arweave_url,
        metadataUrl:    data.metadata_arweave_url,
        nftName:        data.nft_name,
        txSignature:    null,
        stinkScore:     data.stink_score ?? analysis.stink_score,
        archetype:      data.archetype   ?? analysis.archetype,
      }

      // Mock / no Merkle tree — show Arweave success without tx
      if (data.status === 'mock_no_backend' || !data.mint_tx_base64) {
        setReceipt(partial)
        setStatus('success')
        onMinted?.(partial)
        return
      }

      // 2. Sign — Bubblegum uses VersionedTransaction (v0)
      setStatus('signing')
      const txBytes = Buffer.from(data.mint_tx_base64, 'base64')
      let signedTx: VersionedTransaction | Transaction
      try {
        const vtx = VersionedTransaction.deserialize(txBytes)
        signedTx  = await (signTransaction as any)(vtx)
      } catch {
        const tx = Transaction.from(txBytes)
        signedTx = await (signTransaction as any)(tx)
      }

      // 3. Broadcast
      setStatus('broadcasting')
      const raw = signedTx instanceof VersionedTransaction
        ? signedTx.serialize()
        : (signedTx as Transaction).serialize()

      const signature = await connection.sendRawTransaction(raw, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      })

      // 4. Confirm
      setStatus('confirming')
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')

      const full: FocReceipt = { ...partial, txSignature: signature }
      setReceipt(full)
      setStatus('success')
      onMinted?.(full)

    } catch (e: any) {
      const msg = e?.message ?? 'Unknown error'
      setError(msg.includes('rejected') || msg.includes('cancelled') ? 'Transaction cancelled in wallet.' : msg)
      setStatus('error')
    }
  }, [analysis, audioBase64, connected, publicKey, signTransaction, connection, emissionId, onMinted])

  const isActive = ['uploading','signing','broadcasting','confirming'].includes(status)
  const canMint  = !!analysis && connected && (status === 'idle' || status === 'error')

  return (
    <div className="space-y-3 w-full">

      {!connected && (
        <div className="flex flex-col items-center gap-2 py-2">
          <p className="font-mono text-[10px] text-white/30 text-center">
            Connect wallet to mint your Fart Receipt as a Solana cNFT
          </p>
          <WalletMultiButton className="!font-mono !text-xs !tracking-wider !rounded-xl" />
        </div>
      )}

      {connected && (
        <motion.button
          onClick={canMint ? mint : status === 'error' ? () => setStatus('idle') : undefined}
          disabled={isActive || status === 'success'}
          whileTap={canMint ? { scale: 0.97 } : {}}
          className={`
            w-full py-3 rounded-xl font-mono font-black text-sm tracking-wider
            border transition-all duration-200
            ${status === 'success'  ? 'bg-[#00ff8815] border-[#00ff8840] text-[#00ff88] cursor-default'
            : status === 'error'    ? 'bg-red-500/10 border-red-500/30 text-red-400 cursor-pointer hover:bg-red-500/20'
            : isActive              ? 'bg-[#8b00ff15] border-[#8b00ff40] text-[#cc88ff] cursor-wait'
            : canMint               ? 'bg-[#8b00ff20] border-[#8b00ff60] text-[#cc88ff] hover:bg-[#8b00ff30] cursor-pointer'
            :                         'bg-white/5 border-white/10 text-white/20 cursor-not-allowed'}
          `}
        >
          {isActive
            ? <span className="flex items-center justify-center gap-2">
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>💨</motion.span>
                {STATUS_LABELS[status]}
              </span>
            : STATUS_LABELS[status]
          }
        </motion.button>
      )}

      <AnimatePresence>
        {status === 'success' && receipt && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="holo rounded-xl p-4 space-y-3">

            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono font-black text-sm text-white">{receipt.nftName}</div>
                <div className="font-mono text-[10px] text-white/40">{receipt.archetype}</div>
              </div>
              <div className="text-center">
                <div className="font-mono font-black text-2xl neon">{receipt.stinkScore}</div>
                <div className="font-mono text-[8px] text-white/30">/10 STINK</div>
              </div>
            </div>

            {/* Arweave audio */}
            <div>
              <div className="font-mono text-[8px] text-white/20 uppercase tracking-widest mb-1">Audio — Permanent on Arweave 🌐</div>
              <a href={receipt.audioArweaveUrl} target="_blank" rel="noopener noreferrer"
                className="font-mono text-[10px] text-[#00ff88] break-all hover:underline">
                {receipt.audioArweaveUrl}
              </a>
            </div>

            {/* Solana tx */}
            {receipt.txSignature && receipt.txSignature !== 'MOCK_NO_BACKEND' && (
              <div className="pt-2 border-t border-white/5">
                <div className="font-mono text-[8px] text-white/20 uppercase tracking-widest mb-1">cNFT — Solana ⛓️</div>
                <a href={`${SOLSCAN}/${receipt.txSignature}`} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-[10px] text-[#cc88ff] break-all hover:underline">
                  {receipt.txSignature.slice(0, 24)}...{receipt.txSignature.slice(-8)}
                </a>
              </div>
            )}

            {!receipt.txSignature && (
              <div className="pt-2 border-t border-white/5 font-mono text-[9px] text-yellow-400/70">
                Audio on Arweave forever. Run <code className="text-white/40">npx ts-node scripts/create-merkle-tree.ts</code> to enable cNFT minting.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && status === 'error' && (
        <div className="font-mono text-[10px] text-red-400 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          {error}
        </div>
      )}

      <div className="font-mono text-[8px] text-white/15 text-center">
        Audio forever on Arweave · Compressed NFT on Solana · FOC-1 Standard
      </div>
    </div>
  )
}
