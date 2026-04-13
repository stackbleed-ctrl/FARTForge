/**
 * scripts/create-merkle-tree.ts
 * ================================
 * One-time setup: creates a Merkle tree on Solana for FARTForge cNFT minting.
 * Run this ONCE, then set FARTFORGE_MERKLE_TREE=<address> in your .env
 *
 * Cost: ~0.07–0.15 SOL depending on tree size (covers ~16k NFTs at depth 14)
 *
 * Usage:
 *   npx ts-node scripts/create-merkle-tree.ts
 *   npx ts-node scripts/create-merkle-tree.ts --depth 20 --buffer 64   # larger tree
 *
 * Requirements:
 *   npm install @metaplex-foundation/mpl-bubblegum \
 *               @metaplex-foundation/umi \
 *               @metaplex-foundation/umi-bundle-defaults \
 *               @solana-program/account-compression \
 *               bs58 tsx
 */

import {
  createUmi,
} from '@metaplex-foundation/umi-bundle-defaults'
import {
  createTree,
  mplBubblegum,
} from '@metaplex-foundation/mpl-bubblegum'
import {
  keypairIdentity,
  generateSigner,
} from '@metaplex-foundation/umi'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// ── Config ──────────────────────────────────────────────────────────────────

const RPC_URL    = process.env.NEXT_PUBLIC_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com'
const KEYPAIR_PATH = process.env.SOLANA_KEYPAIR_PATH  ?? join(homedir(), '.config', 'solana', 'id.json')

// Tree parameters — tradeoff between upfront SOL cost and max NFT capacity
// depth=14, buffer=64  → ~16,384 NFTs  → ~0.07 SOL  ← DEFAULT (good for launch)
// depth=17, buffer=64  → ~131,072 NFTs → ~0.12 SOL  ← scale tier
// depth=20, buffer=256 → ~1,048,576 NFTs → ~0.45 SOL ← if you go viral 💨
const MAX_DEPTH         = parseInt(process.argv[process.argv.indexOf('--depth')  + 1] ?? '14')
const MAX_BUFFER_SIZE   = parseInt(process.argv[process.argv.indexOf('--buffer') + 1] ?? '64')
const CANOPY_DEPTH      = MAX_DEPTH >= 20 ? 10 : MAX_DEPTH >= 17 ? 6 : 0

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════╗
║   💨  FARTFORGE — Create Merkle Tree (one-time)     ║
╚══════════════════════════════════════════════════════╝
  RPC:    ${RPC_URL}
  Depth:  ${MAX_DEPTH}  (max NFTs: ${Math.pow(2, MAX_DEPTH).toLocaleString()})
  Buffer: ${MAX_BUFFER_SIZE}
  Canopy: ${CANOPY_DEPTH}
`)

  // Load wallet keypair
  if (!existsSync(KEYPAIR_PATH)) {
    console.error(`❌ Keypair not found at ${KEYPAIR_PATH}`)
    console.error('   Generate one with: solana-keygen new')
    console.error('   Or set SOLANA_KEYPAIR_PATH=/path/to/keypair.json')
    process.exit(1)
  }

  const keypairBytes = JSON.parse(readFileSync(KEYPAIR_PATH, 'utf-8')) as number[]
  const umi = createUmi(RPC_URL).use(mplBubblegum())

  const keypair = umi.eddsa.createKeypairFromSecretKey(
    new Uint8Array(keypairBytes)
  )
  umi.use(keypairIdentity(keypair))

  console.log(`  Wallet: ${keypair.publicKey}`)

  // Check balance
  const balance = await umi.rpc.getBalance(keypair.publicKey)
  const balanceSol = Number(balance.basisPoints) / 1e9
  console.log(`  Balance: ${balanceSol.toFixed(4)} SOL`)

  if (balanceSol < 0.05) {
    console.error('❌ Insufficient balance. Need at least 0.05 SOL.')
    console.error(`   Fund your wallet: ${keypair.publicKey}`)
    process.exit(1)
  }

  // Generate tree signer
  const merkleTree = generateSigner(umi)
  console.log(`\n  Creating Merkle tree: ${merkleTree.publicKey}`)
  console.log('  Sending transaction...\n')

  try {
    const builder = await createTree(umi, {
      merkleTree,
      maxDepth: MAX_DEPTH,
      maxBufferSize: MAX_BUFFER_SIZE,
      canopyDepth: CANOPY_DEPTH,
    })

    const result = await builder.sendAndConfirm(umi)
    const sig = Buffer.from(result.signature).toString('base64')

    console.log(`✅ Merkle tree created!`)
    console.log(`   Address:   ${merkleTree.publicKey}`)
    console.log(`   Tx sig:    ${sig.slice(0, 44)}...`)
    console.log(`   Capacity:  ${Math.pow(2, MAX_DEPTH).toLocaleString()} NFTs`)

    // Save to .env hint file
    const envLine = `FARTFORGE_MERKLE_TREE=${merkleTree.publicKey}`
    const outputPath = join(process.cwd(), '.merkle-tree-address')
    writeFileSync(outputPath, `${envLine}\n# Created: ${new Date().toISOString()}\n# Tx: ${sig}\n`)

    console.log(`\n  ─────────────────────────────────────────────────`)
    console.log(`  Add this to your .env files:`)
    console.log(`\n  ${envLine}\n`)
    console.log(`  Saved to: ${outputPath}`)
    console.log(`  ─────────────────────────────────────────────────`)
    console.log(`\n  You can now mint Fart Receipt cNFTs! 💨`)
    console.log(`  Buy $FARTFORGE: https://pump.fun/coin/5Rc86umhtn3UwBqDzexhpkZkeStifJt2sBG6Aj1Spump\n`)

  } catch (error: any) {
    console.error('❌ Tree creation failed:', error?.message ?? error)
    if (error?.toString().includes('insufficient')) {
      console.error('   Top up your wallet and retry.')
    }
    process.exit(1)
  }
}

main().catch(console.error)
