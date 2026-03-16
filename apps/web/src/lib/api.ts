const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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

  // Handle token refresh on 401
  if (response.status === 401 && endpoint !== '/auth/refresh') {
    try {
      await refreshToken();
      // Retry the original request
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

      if (!retryResponse.ok) {
        const error = await retryResponse.json().catch(() => ({
          message: 'An error occurred',
        }));
        throw new Error(error.error?.message || 'Request failed');
      }

      return retryResponse.json();
    } catch (refreshError) {
      // Redirect to login if refresh fails
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw refreshError;
    }
  }

  if (!response.ok) {
    let error: any;
    const contentType = response.headers.get('content-type');
    
    try {
      if (contentType && contentType.includes('application/json')) {
        error = await response.json();
      } else {
        const text = await response.text();
        error = {
          success: false,
          error: {
            message: text || `Request failed with status ${response.status}`,
          },
        };
      }
    } catch (parseError) {
      console.error('Failed to parse error response:', parseError);
      error = {
        success: false,
        error: {
          message: `Request failed with status ${response.status}`,
        },
      };
    }
    
    const errorMessage = error.error?.message || error.message || `Request failed with status ${response.status}`;
    const apiError = new Error(errorMessage);
    (apiError as any).status = response.status;
    (apiError as any).code = error.error?.code;
    throw apiError;
  }

  return response.json();
}
