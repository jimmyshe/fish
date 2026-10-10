import { generateKeyPairSync, sign as cryptoSign } from 'crypto'
import { createServer, type Server } from 'http'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { AddressInfo } from 'net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createAuthModule, type AuthModule } from './auth'

// ── 测试接缝 ──────────────────────────────────────
// 假 PocketID：真实本地 HTTP 服务器，stub discovery / jwks / token / userinfo 端点；
// id_token 用自签 RSA（RS256），openid-client 内建验签走真 JWKS。
// 登录回调由测试侧直接 HTTP GET loopback 回调 URL 驱动；opener 注入为 noop。

/** 与 auth.ts 默认常量一致（测试不覆盖 clientId，aud 须匹配） */
const CLIENT_ID = '9ddf1299-7c61-4987-8d27-cdfdc04fcd49'

const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url')

/** 未签名的假 JWT（仅用于 access token：不参与验签，只测解 claim） */
function fakeJwt(payload: Record<string, unknown>): string {
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`
}

interface TokenResponse {
  status?: number
  body?: Record<string, unknown>
}

interface FakePocketId {
  issuer: string
  /** 收到的 token 端点请求体（按顺序） */
  tokenRequests: Array<Record<string, string>>
  userinfoHits: number
  /** 下一次 token 请求的响应（默认按 grant_type 给正常响应） */
  nextTokenResponse: TokenResponse | null
  /** RS256 自签 id_token（payload 自动补 iss/aud/exp/iat） */
  signIdToken: (claims: Record<string, unknown>) => string
  close: () => Promise<void>
}

async function startFakePocketId(options: { username?: string } = {}): Promise<FakePocketId> {
  const username = options.username ?? '小鱼干'
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' }

  const fake: FakePocketId = {
    issuer: '',
    tokenRequests: [],
    userinfoHits: 0,
    nextTokenResponse: null,
    signIdToken: (claims) => {
      const payload = {
        iss: fake.issuer,
        aud: CLIENT_ID,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        ...claims
      }
      const data = `${b64({ alg: 'RS256', kid: 'test-key', typ: 'JWT' })}.${b64(payload)}`
      return `${data}.${cryptoSign('sha256', Buffer.from(data), privateKey).toString('base64url')}`
    },
    close: () => Promise.resolve()
  }

  const sendJson = (res: import('http').ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Connection': 'close' })
    res.end(JSON.stringify(body))
  }

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (req.method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
      sendJson(res, 200, {
        issuer: fake.issuer,
        authorization_endpoint: `${fake.issuer}/authorize`,
        token_endpoint: `${fake.issuer}/api/oidc/token`,
        userinfo_endpoint: `${fake.issuer}/api/oidc/userinfo`,
        jwks_uri: `${fake.issuer}/api/oidc/jwks`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: ['openid', 'profile', 'fish:play'],
        token_endpoint_auth_methods_supported: ['none']
      })
      return
    }
    if (req.method === 'GET' && url.pathname === '/api/oidc/jwks') {
      sendJson(res, 200, { keys: [jwk] })
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/oidc/token') {
      let raw = ''
      req.on('data', (chunk) => { raw += chunk })
      req.on('end', () => {
        const params = Object.fromEntries(new URLSearchParams(raw))
        fake.tokenRequests.push(params)
        const override = fake.nextTokenResponse
        fake.nextTokenResponse = null
        const resp: Required<TokenResponse> = override?.body !== undefined || override?.status !== undefined
          ? { status: override.status ?? 200, body: override.body ?? {} }
          : params.grant_type === 'refresh_token'
            ? {
                status: 200,
                body: {
                  access_token: fakeJwt({ sub: 'user-1', preferred_username: username, nbf: Math.floor(Date.now() / 1000) }),
                  refresh_token: `${params.refresh_token}-rotated`,
                  expires_in: 3600,
                  token_type: 'Bearer'
                }
              }
            : {
              status: 200,
              body: {
                access_token: fakeJwt({ sub: 'user-1', preferred_username: username }),
                id_token: fake.signIdToken({ sub: 'user-1', preferred_username: username }),
                refresh_token: 'rt-1',
                expires_in: 3600,
                token_type: 'Bearer'
              }
            }
        sendJson(res, resp.status, resp.body)
      })
      return
    }
    if (req.method === 'GET' && url.pathname === '/api/oidc/userinfo') {
      fake.userinfoHits++
      sendJson(res, 200, { sub: 'user-1', preferred_username: username })
      return
    }
    res.writeHead(404, { 'Connection': 'close' })
    res.end()
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  fake.issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  fake.close = () => new Promise<void>((resolve) => server.close(() => resolve()))
  return fake
}

/** 假 safeStorage：可逆但非明文（验证写盘内容确实经过加密通道） */
const fakeSafeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (plain: string): Buffer => Buffer.from(`enc:${plain}`, 'utf-8'),
  decryptString: (encrypted: Buffer): string => {
    const s = encrypted.toString('utf-8')
    if (!s.startsWith('enc:')) throw new Error('not encrypted')
    return s.slice(4)
  }
}

describe('auth module', () => {
  let dir: string
  let authPath: string
  let fake: FakePocketId
  let auth: AuthModule
  let openedUrls: string[]

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'fish-auth-test-'))
    authPath = join(dir, 'auth.json')
    fake = await startFakePocketId()
    openedUrls = []
  })

  afterEach(async () => {
    await fake.close()
    rmSync(dir, { recursive: true, force: true })
  })

  function createAuth(): AuthModule {
    return createAuthModule({
      authPath,
      safeStorage: fakeSafeStorage,
      opener: (url) => { openedUrls.push(url) },
      issuer: fake.issuer
    })
  }

  /** 等 opener 被调用（loopback 服务器已起、授权页已「打开」） */
  async function waitForOpener(): Promise<void> {
    await new Promise<void>((resolve) => {
      const tick = (): void => {
        if (openedUrls.length > 0) resolve()
        else setImmediate(tick)
      }
      tick()
    })
  }

  /** 从 opener 收到的 authorize URL 里抠出 state，驱动 loopback 回调 */
  async function driveCallback(params: Record<string, string> = {}): Promise<void> {
    expect(openedUrls).toHaveLength(1)
    const authorizeUrl = new URL(openedUrls[0])
    const state = params.state ?? authorizeUrl.searchParams.get('state')!
    const code = params.code ?? 'auth-code-1'
    await fetch(`http://127.0.0.1:12344/callback?code=${code}&state=${state}`)
  }

  async function loginSuccessfully(): Promise<void> {
    const loginPromise = auth.login()
    await waitForOpener()
    await driveCallback()
    await loginPromise
  }

  it('login 全流程：打开授权页 → 回调换 token → signedIn 且用户名正确', async () => {
    auth = createAuth()
    expect(auth.getState()).toEqual({ signedIn: false })

    const loginPromise = auth.login()
    await waitForOpener()

    // authorize 请求参数照 prototype_login.py：PKCE S256 + resource
    const authorizeUrl = new URL(openedUrls[0])
    expect(authorizeUrl.origin).toBe(fake.issuer)
    expect(authorizeUrl.pathname).toBe('/authorize')
    expect(authorizeUrl.searchParams.get('response_type')).toBe('code')
    expect(authorizeUrl.searchParams.get('client_id')).toBe(CLIENT_ID)
    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:12344/callback')
    expect(authorizeUrl.searchParams.get('scope')).toBe('openid profile fish:play')
    expect(authorizeUrl.searchParams.get('resource')).toBe('https://fishpet.ddoo.uk')
    expect(authorizeUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authorizeUrl.searchParams.get('code_challenge')).toBeTruthy()

    await driveCallback()
    await loginPromise

    expect(auth.getState()).toEqual({ signedIn: true, username: '小鱼干' })
    // token 端点收到 authorization_code 交换，带 PKCE verifier
    expect(fake.tokenRequests).toHaveLength(1)
    expect(fake.tokenRequests[0].grant_type).toBe('authorization_code')
    expect(fake.tokenRequests[0].code).toBe('auth-code-1')
    expect(fake.tokenRequests[0].code_verifier).toBeTruthy()
    expect(fake.tokenRequests[0].redirect_uri).toBe('http://127.0.0.1:12344/callback')
  })

  it('id_token 无用户名 claim 时回退 userinfo 取用户名', async () => {
    fake.nextTokenResponse = {
      status: 200,
      body: {
        access_token: fakeJwt({ sub: 'user-1' }),
        id_token: fake.signIdToken({ sub: 'user-1' }),
        refresh_token: 'rt-1',
        expires_in: 3600,
        token_type: 'Bearer'
      }
    }
    auth = createAuth()
    await loginSuccessfully()

    expect(fake.userinfoHits).toBe(1)
    expect(auth.getState()).toEqual({ signedIn: true, username: '小鱼干' })
  })

  it('持久化往返：login 后写加密文件，新实例 load 恢复登录态', async () => {
    auth = createAuth()
    await loginSuccessfully()

    // 写盘内容经过 safeStorage 加密通道，不是明文 token
    expect(existsSync(authPath)).toBe(true)
    const onDisk = readFileSync(authPath, 'utf-8')
    expect(onDisk).not.toContain('rt-1')
    expect(onDisk).not.toContain('小鱼干')

    // 新实例（模拟重启）：load 经 refresh_token 静默恢复登录态
    const revived = createAuth()
    expect(revived.getState()).toEqual({ signedIn: false })
    await revived.load()

    expect(revived.getState()).toEqual({ signedIn: true, username: '小鱼干' })
    const refreshReq = fake.tokenRequests.find((r) => r.grant_type === 'refresh_token')
    expect(refreshReq).toBeTruthy()
    expect(refreshReq!.refresh_token).toBe('rt-1')
    expect(refreshReq!.client_id).toBe(CLIENT_ID)
  })

  it('access token 过期：getAccessToken 自动用 refresh_token 续期', async () => {
    // 首次换 token 立即过期（expires_in: 0）
    fake.nextTokenResponse = {
      status: 200,
      body: {
        access_token: fakeJwt({ sub: 'user-1', preferred_username: '小鱼干', tag: 'old' }),
        id_token: fake.signIdToken({ sub: 'user-1', preferred_username: '小鱼干' }),
        refresh_token: 'rt-1',
        expires_in: 0,
        token_type: 'Bearer'
      }
    }
    auth = createAuth()
    await loginSuccessfully()

    const token = await auth.getAccessToken()

    expect(token).toBeTruthy()
    // 触发了一次 refresh_token 续期，返回的是续期后的新 token
    const refreshReq = fake.tokenRequests.find((r) => r.grant_type === 'refresh_token')
    expect(refreshReq).toBeTruthy()
    const claims = JSON.parse(Buffer.from(token!.split('.')[1], 'base64url').toString())
    expect(claims.preferred_username).toBe('小鱼干')
    expect(claims.nbf).toBeTruthy() // 续期响应里的新 token（带 nbf 标记）
    expect(auth.getState()).toEqual({ signedIn: true, username: '小鱼干' })

    // 续期后 token 有效期内不再重复 refresh
    const before = fake.tokenRequests.length
    await auth.getAccessToken()
    expect(fake.tokenRequests.length).toBe(before)
  })

  it('refresh 被拒（400）：静默退回未登录并清除持久化文件', async () => {
    fake.nextTokenResponse = {
      status: 200,
      body: {
        access_token: fakeJwt({ sub: 'user-1', preferred_username: '小鱼干' }),
        id_token: fake.signIdToken({ sub: 'user-1', preferred_username: '小鱼干' }),
        refresh_token: 'rt-1',
        expires_in: 0, // 立即过期，逼出 refresh
        token_type: 'Bearer'
      }
    }
    auth = createAuth()
    await loginSuccessfully()
    expect(existsSync(authPath)).toBe(true)

    const states: Array<{ signedIn: boolean; username?: string }> = []
    auth.onStateChanged((s) => states.push(s))

    // 服务器拒绝续期（如 refresh_token 已被吊销）
    fake.nextTokenResponse = { status: 400, body: { error: 'invalid_grant' } }
    const token = await auth.getAccessToken()

    expect(token).toBeNull()
    expect(auth.getState()).toEqual({ signedIn: false })
    expect(states).toEqual([{ signedIn: false }]) // 推送了一次登出
    expect(existsSync(authPath)).toBe(false) // 持久化文件已清
  })

  it('refresh 遇网络错误：保留登录态等下次，不清持久化', async () => {
    fake.nextTokenResponse = {
      status: 200,
      body: {
        access_token: fakeJwt({ sub: 'user-1', preferred_username: '小鱼干' }),
        id_token: fake.signIdToken({ sub: 'user-1', preferred_username: '小鱼干' }),
        refresh_token: 'rt-1',
        expires_in: 0,
        token_type: 'Bearer'
      }
    }
    auth = createAuth()
    await loginSuccessfully()

    // 断网：关掉假服务器模拟网络错误
    await fake.close()
    const token = await auth.getAccessToken()

    expect(token).toBeNull()
    expect(auth.getState()).toEqual({ signedIn: true, username: '小鱼干' }) // 登录态保留
    expect(existsSync(authPath)).toBe(true) // 持久化保留
  })

  it('logout：状态 signedOut、持久化文件删除', async () => {
    auth = createAuth()
    await loginSuccessfully()
    expect(existsSync(authPath)).toBe(true)

    const states: Array<{ signedIn: boolean; username?: string }> = []
    auth.onStateChanged((s) => states.push(s))

    await auth.logout()

    expect(auth.getState()).toEqual({ signedIn: false })
    expect(states).toEqual([{ signedIn: false }])
    expect(existsSync(authPath)).toBe(false)
    expect(await auth.getAccessToken()).toBeNull()
  })

  it('state 不匹配：login reject，状态不污染，端口释放可重试', async () => {
    auth = createAuth()
    const loginPromise = auth.login()
    await waitForOpener()

    const assertion = expect(loginPromise).rejects.toThrow(/state/)
    await driveCallback({ state: 'forged-state' })
    await assertion

    expect(auth.getState()).toEqual({ signedIn: false })
    expect(existsSync(authPath)).toBe(false)
    expect(fake.tokenRequests).toHaveLength(0) // 没拿错 code 去换 token

    // 端口已释放：可以立刻重新发起登录并成功
    openedUrls = []
    await loginSuccessfully()
    expect(auth.getState()).toEqual({ signedIn: true, username: '小鱼干' })
  })

  it('回调带 error：login reject，状态不污染', async () => {
    auth = createAuth()
    const loginPromise = auth.login()
    await waitForOpener()

    const authorizeUrl = new URL(openedUrls[0])
    const state = authorizeUrl.searchParams.get('state')!
    const assertion = expect(loginPromise).rejects.toThrow(/access_denied/)
    await fetch(`http://127.0.0.1:12344/callback?error=access_denied&state=${state}`)
    await assertion

    expect(auth.getState()).toEqual({ signedIn: false })
    expect(existsSync(authPath)).toBe(false)
    expect(fake.tokenRequests).toHaveLength(0)
  })
})
