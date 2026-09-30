import axios from 'axios'
import { env } from '@/lib/env'

// Shared HTTP client for the Node backend. Auth and error interceptors go here
// once the server's auth scheme is decided.
export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})
