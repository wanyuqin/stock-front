import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

// ── 超时常量 ──────────────────────────────────────────────────────
export const DEFAULT_TIMEOUT = 15_000   // 普通接口 15s
export const AI_TIMEOUT      = 180_000  // AI 分析接口 3 分钟（大模型生成较慢）

// ── Axios 实例 ────────────────────────────────────────────────────
const http = axios.create({
  baseURL: '/api/v1',
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ── 请求拦截器 ────────────────────────────────────────────────────
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => config,
  (error: AxiosError) => Promise.reject(error),
)

// ── 响应拦截器 ────────────────────────────────────────────────────
http.interceptors.response.use(
  (response: AxiosResponse) => {
    const { data } = response
    if (typeof data?.code === 'number' && data.code !== 0) {
      return Promise.reject(new Error(data.message ?? '请求失败'))
    }
    return response
  },
  (error: AxiosError) => {
    const status = error.response?.status
    let message = '网络异常，请稍后重试'

    if (!error.response) {
      // 区分超时和断连
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        message = 'AI 分析耗时较长，请稍后重试'
      } else {
        message = '无法连接到后端服务（请确认后端已在 :8888 启动）'
      }
    } else if (status === 400) {
      message = '请求参数错误'
    } else if (status === 404) {
      message = '资源不存在'
    } else if (status === 502 || status === 504) {
      message = '行情服务暂时不可用'
    } else if (status === 500) {
      message = '服务器内部错误'
    }

    console.error(`[HTTP ${status ?? 'ERR'}]`, error.config?.url, '→', message)
    return Promise.reject(new Error(message))
  },
)

export default http
