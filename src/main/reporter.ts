/** 铲屎事件上报：事件流、失败即丢弃（ADR 0003），无离线队列、不重试 */
import { DEFAULT_API_BASE_URL } from './apiClient'

export interface ReporterDeps {
  /** 取当前可用 access token（auth 模块）；未登录/暂时不可用返回 null */
  getAccessToken: () => Promise<string | null>
  apiBaseUrl?: string
}

export interface Reporter {
  /** 上报一次铲屎事件；任何失败（未登录/网络/4xx/5xx）一律静默丢弃 */
  reportScoop: () => Promise<void>
}

export function createReporter(deps: ReporterDeps): Reporter {
  const baseUrl = deps.apiBaseUrl ?? DEFAULT_API_BASE_URL

  async function reportScoop(): Promise<void> {
    try {
      const token = await deps.getAccessToken()
      if (!token) return // 未登录不产生计数
      // 客户端生成 UUID 幂等键，服务器去重后计入铲屎计数
      await fetch(`${baseUrl}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ eventId: crypto.randomUUID() })
      })
      // 不检查响应状态：4xx/5xx 与网络错误同语义——丢弃
    } catch {
      // 静默丢弃：不抛错、不排队、不重试
    }
  }

  return { reportScoop }
}
