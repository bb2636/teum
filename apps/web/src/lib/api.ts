import { t } from './i18n';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/** 업로드 이미지 URL을 API 서빙 경로로 변환 (/storage/... → /api/storage/...) */
export function getStorageImageSrc(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const base = import.meta.env.VITE_API_URL || '/api';
  return `${base}/storage/${url.replace(/^\/storage\/?/, '')}`;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

async function refreshToken(): Promise<void> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error('Token refresh failed');
      }
      isRefreshing = false;
      refreshPromise = null;
    })
    .catch((error) => {
      isRefreshing = false;
      refreshPromise = null;
      throw error;
    });

  return refreshPromise;
}

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  // Don't set Content-Type for FormData, let browser set it with boundary
  const isFormData = options?.body instanceof FormData;
  const headers: HeadersInit = isFormData
    ? { ...options?.headers }
    : {
        'Content-Type': 'application/json',
        ...options?.headers,
      };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && endpoint === '/auth/login') {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error?.message || 'Login failed');
  }

  if (response.status === 401 && endpoint !== '/auth/refresh') {
    const errorBody = await response.json().catch(() => null);
    if (errorBody?.error?.code === 'SESSION_EXPIRED') {
      sessionStorage.setItem('teum_logged_out', '1');
      if (typeof window !== 'undefined') {
        // 백엔드 메시지(한국어 고정)는 무시하고 클라이언트 언어로 표시
        alert(t('auth.sessionExpiredOtherDevice'));
        window.location.href = '/splash';
      }
      const err = new Error(t('auth.sessionExpiredOtherDevice')) as Error & { status?: number; code?: string };
      err.status = 401;
      err.code = 'SESSION_EXPIRED';
      throw err;
    }

    try {
      await refreshToken();
      const retryIsFormData = options?.body instanceof FormData;
      const retryHeaders: HeadersInit = retryIsFormData
        ? { ...options?.headers }
        : {
            'Content-Type': 'application/json',
            ...options?.headers,
          };
      const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: retryHeaders,
        credentials: 'include',
      });

      if (retryResponse.status === 401) {
        const retryError = await retryResponse.json().catch(() => null);
        if (retryError?.error?.code === 'SESSION_EXPIRED') {
          sessionStorage.setItem('teum_logged_out', '1');
          if (typeof window !== 'undefined') {
            alert(t('auth.sessionExpiredOtherDevice'));
            window.location.href = '/splash';
          }
          throw new Error(t('auth.sessionExpiredOtherDevice'));
        }
        if (endpoint === '/users/me') {
          const err = new Error('Unauthorized') as Error & { status?: number };
          err.status = 401;
          throw err;
        }
        if (typeof window !== 'undefined') {
          window.location.href = '/splash';
        }
        throw new Error(t('auth.sessionExpiredReLogin'));
      }

      if (!retryResponse.ok) {
        const error = await retryResponse.json().catch(() => ({
          message: 'An error occurred',
        }));
        throw new Error(error.error?.message || 'Request failed');
      }

      return retryResponse.json();
    } catch (refreshError) {
      if (endpoint === '/users/me') {
        const err = new Error('Unauthorized') as Error & { status?: number };
        err.status = 401;
        throw err;
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/splash';
      }
      throw refreshError;
    }
  }

  if (!response.ok) {
    interface ErrorResponse {
      success: false;
      error?: {
        code?: string;
        message?: string;
        details?: unknown;
      };
      message?: string;
    }

    let error: ErrorResponse;
    const contentType = response.headers.get('content-type');
    
    try {
      if (contentType && contentType.includes('application/json')) {
        error = await response.json() as ErrorResponse;
      } else {
        const text = await response.text();
        error = {
          success: false,
          error: {
            message: text || `Request failed with status ${response.status}`,
          },
        };
      }
    } catch {
      error = {
        success: false,
        error: {
          message: `Request failed with status ${response.status}`,
        },
      };
    }
    
    const errorMessage = error.error?.message || error.message || `Request failed with status ${response.status}`;
    const apiError = new Error(errorMessage) as Error & { status?: number; code?: string };
    apiError.status = response.status;
    apiError.code = error.error?.code;
    throw apiError;
  }

  return response.json();
}
