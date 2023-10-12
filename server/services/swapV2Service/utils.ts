import { Pool, Token } from '@alcorexchange/alcor-swap-sdk'

import { createClient } from 'redis'
import { SwapPool } from '../../models'

const redis = createClient()

export async function getPoolInstance(chain: string, id): Promise<Pool> {
  // Based on swap only, right now
  const pool = await SwapPool.findOne({ chain, id }).lean()
  if (!pool) return undefined

  const ticks: any[] = Array.from((await getRedisTicks(chain, id)).values())
  ticks.sort((a, b) => a.id - b.id)

  const { tokenA, tokenB } = pool

  return new Pool({
    ...pool,
    tokenA: new Token(tokenA.contract, tokenA.decimals, tokenA.symbol),
    tokenB: new Token(tokenB.contract, tokenB.decimals, tokenB.symbol),
    tickCurrent: pool.tick,
    ticks
  })
}

export async function getPools(chain: string, fetchTicks = true) {
  // Based on swap only, right now
  const mongoPools = await SwapPool.find({ chain }).lean()

  const pools = []
  for (const p of mongoPools) {
    const ticks = fetchTicks ? await getRedisTicks(chain, p.id) : []

    pools.push(new Pool({
      ...p,
      tokenA: new Token(p.tokenA.contract, p.tokenA.decimals, p.tokenA.symbol),
      tokenB: new Token(p.tokenB.contract, p.tokenB.decimals, p.tokenB.symbol),

      ticks: Array.from(ticks.values()).sort((a, b) => a.id - b.id),
      tickCurrent: p.tick
    }))
  }

  return pools
}

export async function getRedisTicks(chain: string, poolId: number | string) {
  if (!redis.isOpen) await redis.connect()

  const entries = await redis.get(`ticks_${chain}_${poolId}`)
  const plain = JSON.parse(entries || '[]') || []

  const ticks = entries ? new Map([...plain].sort((a, b) => a.id - b.id)) : new Map()
  return ticks
}

export async function getRedisPosition(chain, id) {
  if (!redis.isOpen) await redis.connect()

  const positions = JSON.parse(await redis.get(`positions_${chain}`) || '[]')
  return positions.find(p => p.id == id)
}
