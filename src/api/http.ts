import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

// ── Axios 实例 ────────────────────────────────────────────────────
//
// 请求链路：
//   前端 baseURL = '/api/v1'
//   → Vite dev server proxy '/api' → http://localhost:8888
//   → 后端实际路由  http://localhost:8888/api/v1/stocks  ✓
//
const http = axios.create({
  baseURL: '/api/v1',
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ── 请求拦截器 ────────────────────────────────────────────────────
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 后续接入 JWT 时在此注入：
    // const token = localStorage.getItem('token')
    // if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

// ── 响应拦截器 ────────────────────────────────────────────────────
http.interceptors.response.use(
  (response: AxiosResponse) => {
    const { data } = response
    // 后端统一包装格式：{ code: 0, message: 'ok', data: {...} }
    // code !== 0 视为业务错误
    if (typeof data?.code === 'number' && data.code !== 0) {
      return Promise.reject(new Error(data.message ?? '请求失败'))
    }
    return response
  },
  (error: AxiosError) => {
    const status = error.response?.status
    let message = '网络异常，请稍后重试'

    if (!error.response) {
      message = '无法连接到后端服务（请确认后端已在 :8888 启动）'
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
