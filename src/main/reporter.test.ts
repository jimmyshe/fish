import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createReporter } from './reporter'

// ── 测试接缝 ──────────────────────────────────────
// 假 API：真实本地 HTTP 服务器 stub POST /events；auth 注入为假的 getAccessToken
// （伪造已登录/未登录两种），不碰真 auth 流程。

interface ReceivedEvent {
  authorization: string | undefined
  contentType: string | undefined
  body: Record<string, unknown>
}

interface FakeApi {
  baseUrl: string
  events: ReceivedEvent[]
  /** 下一次请求响应的状态码（默认 200） */
  nextStatus: number | null
  close: () => Promise<void>
}

async function startFakeApi(): Promise<FakeApi> {
  const fake: FakeApi = { baseUrl: '', events: [], nextStatus: null, close: () => Promise.resolve() }
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (req.method === 'POST' && url.pathname === '/events') {
      let raw = ''
      req.on('data', (chunk) => { raw += chunk })
      req.on('end', () => {
        fake.events.push({
          authorization: req.headers.authorization,
          contentType: req.headers['content-type'],
          body: JSON.parse(raw)
        })
        const status = fake.nextStatus ?? 200
        fake.nextStatus = null
        res.writeHead(status, { 'Content-Type': 'application/json', 'Connection': 'close' })
        res.end('{}')
      })
      return
    }
    res.writeHead(404, { 'Connection': 'close' })
    res.end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  fake.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  fake.close = () => new Promise<void>((resolve) => server.close(() => resolve()))
  return fake
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('reporter（铲屎事件上报）', () => {
  let fake: FakeApi

  beforeEach(async () => {
    fake = await startFakeApi()
  })

  afterEach(async () => {
    await fake.close()
  })

  it('已登录：POST /events 到达，带 Bearer 头与 UUID eventId', async () => {
    const reporter = createReporter({
      getAccessToken: async () => 'access-token-1',
      apiBaseUrl: fake.baseUrl
    })

    await reporter.reportScoop()

    expect(fake.events).toHaveLength(1)
    expect(fake.events[0].authorization).toBe('Bearer access-token-1')
    expect(fake.events[0].contentType).toContain('application/json')
    expect(fake.events[0].body.eventId).toMatch(UUID_RE)
  })

  it('未登录：无请求发出', async () => {
    const reporter = createReporter({
      getAccessToken: async () => null,
      apiBaseUrl: fake.baseUrl
    })

    await reporter.reportScoop()

    expect(fake.events).toHaveLength(0)
  })

  it('服务器 500：静默丢弃，不抛异常', async () => {
    fake.nextStatus = 500
    const reporter = createReporter({
      getAccessToken: async () => 'access-token-1',
      apiBaseUrl: fake.baseUrl
    })

    await expect(reporter.reportScoop()).resolves.toBeUndefined()
    expect(fake.events).toHaveLength(1) // 请求发出了，失败即丢弃
  })

  it('网络不可达：静默丢弃，不抛异常', async () => {
    const baseUrl = fake.baseUrl
    await fake.close() // 关掉服务器模拟断网
    const reporter = createReporter({
      getAccessToken: async () => 'access-token-1',
      apiBaseUrl: baseUrl
    })

    await expect(reporter.reportScoop()).resolves.toBeUndefined()
  })
})
