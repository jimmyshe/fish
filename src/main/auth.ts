import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { createServer, type Server } from 'http'
import { dirname } from 'path'
import * as client from 'openid-client'
import type { AuthState } from '../shared/api'

/** OIDC 固定参数：模块内常量 + 环境变量可覆盖（CI 构建期注入见 ADR 0004） */
const DEFAULT_ISSUER = process.env.POCKET_ID_ISSUER ?? 'https://pocketid.ddoo.tech'
const DEFAULT_CLIENT_ID = process.env.FISH_OIDC_CLIENT_ID ?? '9ddf1299-7c61-4987-8d27-cdfdc04fcd49'
const DEFAULT_RESOURCE = process.env.FISH_API_RESOURCE ?? 'https://fishpet.ddoo.uk'
/** loopback 回调固定端口（已在 PocketID 登记，端口占用则报错，不做回退） */
const REDIRECT_URI = 'http://127.0.0.1:12344/callback'
const CALLBACK_PORT = 12344
const SCOPE = 'openid profile fish:play'

/** Electron safeStorage 的最小形状（测试注入假实现） */
export interface SafeStorageLike {
  isEncryptionAvailable: () => boolean
  encryptString: (plain: string) => Buffer
  decryptString: (encrypted: Buffer) => string
}

export interface AuthDeps {
  /** 持久化文件路径（userData/auth.json） */
  authPath: string
  safeStorage: SafeStorageLike
  /** 打开系统浏览器（生产为 shell.openExternal，测试为 noop） */
  opener: (url: string) => void | Promise<unknown>
  issuer?: string
  clientId?: string
  resource?: string
}

export interface AuthModule {
  login: () => Promise<void>
  logout: () => Promise<void>
  getState: () => AuthState
  /** 供上报用：有效则直接返回，过期则静默续期；未登录或暂时不可用返回 null */
  getAccessToken: () => Promise<string | null>
  /** 启动恢复：有持久化 session 则尝试 refresh；失败退回未登录 */
  load: () => Promise<void>
  /** 订阅登录状态变化，返回取消订阅函数 */
  onStateChanged: (callback: (state: AuthState) => void) => () => void
}

export function createAuthModule(deps: AuthDeps): AuthModule {
  const issuer = deps.issuer ?? DEFAULT_ISSUER
  const clientId = deps.clientId ?? DEFAULT_CLIENT_ID
  const resource = deps.resource ?? DEFAULT_RESOURCE

  let state: AuthState = { signedIn: false }
  let listeners: Array<(state: AuthState) => void> = []
  let loginInFlight: Promise<void> | null = null

  /** OIDC 客户端配置（discovery 结果），懒加载缓存；失败清空以便重试 */
  let configPromise: Promise<client.Configuration> | null = null
  function getConfig(): Promise<client.Configuration> {
    if (!configPromise) {
      configPromise = client.discovery(
        new URL(issuer),
        clientId,
        undefined, // 公共客户端：无 secret，库默认 token 端点认证为 none
        undefined,
        // 测试用 http issuer 需要显式放行；生产 https 不受影响
        issuer.startsWith('http:') ? { execute: [client.allowInsecureRequests] } : undefined
      )
      configPromise.catch(() => { configPromise = null })
    }
    return configPromise
  }

  /** 内存中的会话；持久化文件（auth.json）经 safeStorage 加密，不落明文 config.json */
  interface Session {
    refreshToken: string
    accessToken: string
    /** access token 过期时刻（epoch ms） */
    accessTokenExpiresAt: number
    username: string
  }
  let session: Session | null = null
  let refreshInFlight: Promise<'ok' | 'rejected' | 'network'> | null = null

  function persist(): void {
    if (!session) return
    const plain = JSON.stringify(session)
    const encrypted = deps.safeStorage.isEncryptionAvailable()
    const data = encrypted
      ? deps.safeStorage.encryptString(plain).toString('base64')
      : plain // 无系统密钥环（部分 Linux）时降级明文，功能优先
    const dir = dirname(deps.authPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(deps.authPath, JSON.stringify({ v: 1, encrypted, data }), 'utf-8')
  }

  function clearPersisted(): void {
    if (existsSync(deps.authPath)) unlinkSync(deps.authPath)
  }

  function loadPersisted(): Session | null {
    if (!existsSync(deps.authPath)) return null
    try {
      const file = JSON.parse(readFileSync(deps.authPath, 'utf-8')) as { encrypted: boolean; data: string }
      const plain = file.encrypted
        ? deps.safeStorage.decryptString(Buffer.from(file.data, 'base64'))
        : file.data
      return JSON.parse(plain) as Session
    } catch {
      console.warn(`[auth] 无法解析 ${deps.authPath}，按未登录处理`)
      return null
    }
  }

  function setState(next: AuthState): void {
    if (state.signedIn === next.signedIn && state.username === next.username) return
    state = next
    for (const cb of listeners) cb(state)
  }

  /** 静默退回未登录：清内存会话 + 删持久化文件 + 广播状态 */
  function resetToSignedOut(): void {
    session = null
    clearPersisted()
    setState({ signedIn: false })
  }

  /** token 端点错误（invalid_grant 等）= 服务器拒绝；fetch TypeError = 网络错误 */
  function classifyRefreshError(err: unknown): 'rejected' | 'network' {
    if (err instanceof TypeError) return 'network'
    return 'rejected'
  }

  /**
   * 用 refresh_token 续期（并发去重）。
   * ok：会话已更新并落盘；rejected：服务器拒绝，调用方退回未登录；
   * network：网络错误，保留登录态等下次。
   */
  function refresh(): Promise<'ok' | 'rejected' | 'network'> {
    if (refreshInFlight) return refreshInFlight
    refreshInFlight = doRefresh().finally(() => { refreshInFlight = null })
    return refreshInFlight
  }

  async function doRefresh(): Promise<'ok' | 'rejected' | 'network'> {
    if (!session) return 'rejected'
    let tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
    try {
      tokens = await client.refreshTokenGrant(await getConfig(), session.refreshToken)
    } catch (err) {
      return classifyRefreshError(err)
    }
    if (!tokens.access_token) return 'rejected'
    // refresh_token 可能轮换：以响应为准
    session = {
      refreshToken: tokens.refresh_token ?? session.refreshToken,
      accessToken: tokens.access_token,
      accessTokenExpiresAt: Date.now() + (tokens.expiresIn() ?? 3600) * 1000,
      username: session.username
    }
    persist()
    return 'ok'
  }

  /** 用户名：优先 id_token 的 preferred_username/name，其次 userinfo，最后 sub */
  async function resolveUsername(
    claims: client.IDToken | undefined,
    accessToken: string | undefined
  ): Promise<string> {
    const fromId = claims?.preferred_username ?? claims?.name
    if (typeof fromId === 'string' && fromId) return fromId

    let userinfo: Record<string, unknown> | null = null
    if (accessToken) {
      try {
        const resp = await fetch(`${issuer}/api/oidc/userinfo`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (resp.ok) userinfo = (await resp.json()) as Record<string, unknown>
      } catch {
        // userinfo 网络失败不阻塞登录，继续回退
      }
    }
    const fromUserinfo = userinfo?.preferred_username ?? userinfo?.name
    if (typeof fromUserinfo === 'string' && fromUserinfo) return fromUserinfo
    const sub = claims?.sub ?? userinfo?.sub
    return typeof sub === 'string' && sub ? sub : '摸鱼玩家'
  }

  /** 起 loopback 服务器等回调；返回完整回调 URL（state 校验、error 处理在内部） */
  function waitForCallback(expectedState: string): Promise<URL> {
    return new Promise((resolve, reject) => {
      let settled = false
      // 等服务器真正关闭（释放端口）后才 settle，避免连续两次 login 端口竞态
      const done = (err: Error | null, url?: URL): void => {
        if (settled) return
        settled = true
        server.close(() => {
          if (err) reject(err)
          else resolve(url!)
        })
      }

      const server: Server = createServer((req, res) => {
        const url = new URL(req.url ?? '/', `http://127.0.0.1:${CALLBACK_PORT}`)
        if (url.pathname !== '/callback') {
          res.writeHead(404, { 'Connection': 'close' })
          res.end()
          return
        }
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Connection': 'close' })
        res.end('登录完成，可以关掉这个页面，回到桌面看小鱼。')
        const error = url.searchParams.get('error')
        if (error) {
          done(new Error(`授权失败: ${error}`))
          return
        }
        if (url.searchParams.get('state') !== expectedState) {
          done(new Error('state 不匹配'))
          return
        }
        if (!url.searchParams.get('code')) {
          done(new Error('回调缺少 code'))
          return
        }
        done(null, url)
      })

      server.once('error', (err) => {
        done(new Error(`回调端口 ${CALLBACK_PORT} 被占用或监听失败: ${err.message}`))
      })
      server.listen(CALLBACK_PORT, '127.0.0.1')
    })
  }

  async function login(): Promise<void> {
    if (loginInFlight) return loginInFlight
    loginInFlight = doLogin().finally(() => { loginInFlight = null })
    return loginInFlight
  }

  async function doLogin(): Promise<void> {
    const config = await getConfig()
    // PKCE S256 + state，照 prototype_login.py
    const verifier = client.randomPKCECodeVerifier()
    const challenge = await client.calculatePKCECodeChallenge(verifier)
    const expectedState = client.randomState()

    const callbackPromise = waitForCallback(expectedState)
    try {
      const authorizeUrl = client.buildAuthorizationUrl(config, {
        redirect_uri: REDIRECT_URI,
        scope: SCOPE,
        state: expectedState,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        resource
      })
      await deps.opener(authorizeUrl.href)

      const callbackUrl = await callbackPromise
      // code 换 token；id_token 验签由库内建完成（JWKS 来自 discovery）
      const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: verifier,
        expectedState
      })
      if (!tokens.access_token) throw new Error('换 token 失败：响应缺少 access_token')

      const username = await resolveUsername(tokens.claims(), tokens.access_token)
      session = {
        refreshToken: tokens.refresh_token ?? '',
        accessToken: tokens.access_token,
        accessTokenExpiresAt: Date.now() + (tokens.expiresIn() ?? 3600) * 1000,
        username
      }
      persist()
      setState({ signedIn: true, username })
    } catch (err) {
      // 登录失败不污染状态：保持未登录
      callbackPromise.catch(() => {})
      throw err
    }
  }

  /** access token 有效期安全边距：到期前 30s 即视为过期，提前续期 */
  const EXPIRY_MARGIN_MS = 30_000

  async function getAccessToken(): Promise<string | null> {
    if (!session) return null
    if (Date.now() < session.accessTokenExpiresAt - EXPIRY_MARGIN_MS) {
      return session.accessToken
    }
    const result = await refresh()
    if (result === 'ok') return session!.accessToken
    if (result === 'network') return null // 保留登录态，下次再试
    resetToSignedOut()
    return null
  }

  async function load(): Promise<void> {
    session = loadPersisted()
    if (!session) return
    const result = await refresh()
    if (result === 'rejected') {
      resetToSignedOut()
      return
    }
    // ok 或 network（离线启动）：都恢复登录态，username 用持久化值
    setState({ signedIn: true, username: session.username })
  }

  async function logout(): Promise<void> {
    // 纯本地退出：不调 PocketID end-session
    resetToSignedOut()
  }

  return {
    login,
    logout,
    getState: () => state,
    getAccessToken,
    load,
    onStateChanged: (callback) => {
      listeners.push(callback)
      return () => { listeners = listeners.filter((cb) => cb !== callback) }
    }
  }
}
