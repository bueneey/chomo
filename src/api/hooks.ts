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
    refetchInterval: 4_000,
    staleTime: 2_000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: true,
    retry: 1,
    placeholderData: (prev) => prev,
  })
}

export function useWalletLive() {
  return useQuery({
    queryKey: ['wallet-live'],
    queryFn: () => getJson<LiveWallet>('/wallet/live'),
    refetchInterval: 4_000,
    staleTime: 2_000,
    refetchOnWindowFocus: true,
    retry: 1,
  })
}

export function useWalletChart() {
  return useQuery({
    queryKey: ['wallet-chart'],
    queryFn: () => getJson<ChartResponse>('/wallet/chart'),
    refetchInterval: 4_000,
    staleTime: 2_000,
    refetchOnWindowFocus: true,
    retry: 1,
  })
}

export function useOnchainFeed() {
  return useQuery({
    queryKey: ['feed-onchain'],
    queryFn: () => getJson<FeedResponse>('/feed/onchain?limit=40'),
    refetchInterval: 4_000,
    staleTime: 2_000,
    refetchOnWindowFocus: true,
    retry: 1,
  })
}
