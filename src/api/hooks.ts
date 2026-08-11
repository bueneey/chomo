import { useQuery } from '@tanstack/react-query'
import { config } from '../config'
import type { ChartResponse, ChomoState, FeedResponse, LiveWallet } from '../types'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${config.apiBase}${path}`, { cache: 'no-store' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function useChomoState() {
  return useQuery({
    queryKey: ['chomo-state'],
    queryFn: () => getJson<ChomoState>('/state'),
    refetchInterval: 6_000,
    staleTime: 4_000,
    retry: 1,
  })
}

export function useWalletLive() {
  return useQuery({
    queryKey: ['wallet-live'],
    queryFn: () => getJson<LiveWallet>('/wallet/live'),
    refetchInterval: 8_000,
    staleTime: 4_000,
    retry: 1,
  })
}

export function useWalletChart() {
  return useQuery({
    queryKey: ['wallet-chart'],
    queryFn: () => getJson<ChartResponse>('/wallet/chart'),
    refetchInterval: 30_000,
    staleTime: 10_000,
    retry: 1,
  })
}

export function useOnchainFeed() {
  return useQuery({
    queryKey: ['feed-onchain'],
    queryFn: () => getJson<FeedResponse>('/feed/onchain?limit=50'),
    refetchInterval: 20_000,
    staleTime: 8_000,
    retry: 1,
  })
}
