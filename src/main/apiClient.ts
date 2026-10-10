import type { LeaderboardResponse, MeResponse } from '../shared/api'

/** 联网 API 客户端：/me、/leaderboard、/me/preferences 的唯一属主。
 *  Bearer 来自 auth.getAccessToken()；未登录或任何失败一律返回 null（静默，UI 给占位态）。 */

/** API 固定参数：模块内常量 + 环境变量可覆盖（CI 构建期注入见 ADR 0004）；reporter 共用 */
export const DEFAULT_API_BASE_URL = process.env.FISH_API_BASE_URL || 'https://fishpet.ddoo.uk'

export interface ApiClientDeps {
  /** 取当前可用 access token（auth 模块）；未登录/暂时不可用返回 null */
  getAccessToken: () => Promise<string | null>
  apiBaseUrl?: string
}

export interface ApiClient {
  getMe: () => Promise<MeResponse | null>
  getLeaderboard: () => Promise<LeaderboardResponse | null>
  /** 失败静默（不抛错）；调用方需要权威值时应重新 getMe */
  setShowOnLeaderboard: (show: boolean) => Promise<void>
}

export function createApiClient(deps: ApiClientDeps): ApiClient {
  const baseUrl = deps.apiBaseUrl ?? DEFAULT_API_BASE_URL

  /** 带 Bearer 的请求；未登录/网络错误/非 2xx 一律返回 null */
  async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T | null> {
    try {
      const token = await deps.getAccessToken()
      if (!token) return null
      const resp = await fetch(`${baseUrl}${path}`, {
        method: init?.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {})
        },
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined
      })
      if (!resp.ok) return null
      return (await resp.json()) as T
    } catch {
      return null
    }
  }

  return {
    getMe: () => call<MeResponse>('/me'),
    getLeaderboard: () => call<LeaderboardResponse>('/leaderboard'),
    setShowOnLeaderboard: async (show) => {
      await call('/me/preferences', { method: 'PUT', body: { showOnLeaderboard: show } })
    }
  }
}
