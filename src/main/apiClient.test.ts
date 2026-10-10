import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApiClient } from './apiClient'

// ── 测试接缝 ──────────────────────────────────────
// 假 API：真实本地 HTTP 服务器 stub /me、/leaderboard、/me/preferences；
// auth 注入为假的 getAccessToken（伪造已登录/未登录），不碰真 auth 流程。

interface ReceivedRequest {
  method: string
  path: string
  authorization: string | undefined
  body: Record<string, unknown> | null
}

interface FakeApi {
  baseUrl: string
  requests: ReceivedRequest[]
  /** 下一次请求响应的状态码（默认 200） */
  nextStatus: number | null
  showOnLeaderboard: boolean
  close: () => Promise<void>
}

async function startFakeApi(): Promise<FakeApi> {
  const fake: FakeApi = { baseUrl: '', requests: [], nextStatus: null, showOnLeaderboard: true, close: () => Promise.resolve() }

  const sendJson = (res: import('http').ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Connection': 'close' })
    res.end(JSON.stringify(body))
  }

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const readBody = (cb: (body: Record<string, unknown> | null) => void): void => {
      let raw = ''
      req.on('data', (chunk) => { raw += chunk })
      req.on('end', () => cb(raw ? JSON.parse(raw) : null))
    }
    readBody((body) => {
      fake.requests.push({ method: req.method ?? '', path: url.pathname, authorization: req.headers.authorization, body })
      const status = fake.nextStatus ?? 200
      fake.nextStatus = null
      if (req.method === 'GET' && url.pathname === '/me') {
        sendJson(res, status, status === 200 ? { count: 6, rank: 2, showOnLeaderboard: fake.showOnLeaderboard } : {})
        return
      }
      if (req.method === 'GET' && url.pathname === '/leaderboard') {
        sendJson(res, status, status === 200
          ? { entries: [{ rank: 1, username: 'jimmy', count: 42 }, { rank: 2, username: '小鱼干', count: 6 }], me: { rank: 2, count: 6 } }
          : {})
        return
      }
      if (req.method === 'PUT' && url.pathname === '/me/preferences') {
        if (status === 200 && body) fake.showOnLeaderboard = Boolean(body.showOnLeaderboard)
        sendJson(res, status, status === 200 ? { showOnLeaderboard: fake.showOnLeaderboard } : {})
        return
      }
      sendJson(res, 404, {})
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  fake.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  fake.close = () => new Promise<void>((resolve) => server.close(() => resolve()))
  return fake
}

describe('apiClient（联网 API）', () => {
  let fake: FakeApi

  beforeEach(async () => {
    fake = await startFakeApi()
  })

  afterEach(async () => {
    await fake.close()
  })

  function createClient(token: string | null) {
    return createApiClient({ getAccessToken: async () => token, apiBaseUrl: fake.baseUrl })
  }

  it('getMe 成功：带 Bearer 头，返回计数/名次/上榜开关', async () => {
    const api = createClient('access-token-1')
    const me = await api.getMe()

    expect(me).toEqual({ count: 6, rank: 2, showOnLeaderboard: true })
    expect(fake.requests[0].authorization).toBe('Bearer access-token-1')
    expect(fake.requests[0].method).toBe('GET')
  })

  it('getMe 未登录：返回 null 且不发请求', async () => {
    const api = createClient(null)
    expect(await api.getMe()).toBeNull()
    expect(fake.requests).toHaveLength(0)
  })

  it('getMe 服务器 500：返回 null（静默）', async () => {
    fake.nextStatus = 500
    const api = createClient('access-token-1')
    expect(await api.getMe()).toBeNull()
  })

  it('getLeaderboard 成功：返回榜单与本人名次', async () => {
    const api = createClient('access-token-1')
    const lb = await api.getLeaderboard()

    expect(lb).toEqual({
      entries: [{ rank: 1, username: 'jimmy', count: 42 }, { rank: 2, username: '小鱼干', count: 6 }],
      me: { rank: 2, count: 6 }
    })
    expect(fake.requests[0].authorization).toBe('Bearer access-token-1')
  })

  it('getLeaderboard 未登录：返回 null 且不发请求', async () => {
    const api = createClient(null)
    expect(await api.getLeaderboard()).toBeNull()
    expect(fake.requests).toHaveLength(0)
  })

  it('getLeaderboard 服务器 500：返回 null（静默）', async () => {
    fake.nextStatus = 500
    const api = createClient('access-token-1')
    expect(await api.getLeaderboard()).toBeNull()
  })

  it('setShowOnLeaderboard 成功：PUT 携带开关值', async () => {
    const api = createClient('access-token-1')
    await api.setShowOnLeaderboard(false)

    expect(fake.requests[0].method).toBe('PUT')
    expect(fake.requests[0].path).toBe('/me/preferences')
    expect(fake.requests[0].body).toEqual({ showOnLeaderboard: false })
    expect(fake.requests[0].authorization).toBe('Bearer access-token-1')
  })

  it('setShowOnLeaderboard 未登录：静默返回，不发请求', async () => {
    const api = createClient(null)
    await expect(api.setShowOnLeaderboard(false)).resolves.toBeUndefined()
    expect(fake.requests).toHaveLength(0)
  })

  it('setShowOnLeaderboard 服务器 500：静默返回，不抛异常', async () => {
    fake.nextStatus = 500
    const api = createClient('access-token-1')
    await expect(api.setShowOnLeaderboard(false)).resolves.toBeUndefined()
  })
})
