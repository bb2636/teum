/**
 * IP 기반 국가 감지 유틸리티
 * 무료 API 사용: ip-api.com (rate limit: 45 requests/minute)
 */

interface IpApiResponse {
  status: string;
  countryCode?: string;
  country?: string;
  message?: string;
}

/**
 * IP 주소에서 국가 코드를 감지합니다.
 * @param ip - 클라이언트 IP 주소
 * @returns 국가 코드 (예: 'KR', 'US') 또는 null
 */
export async function detectCountryFromIp(ip: string): Promise<string | null> {
  try {
    // localhost나 private IP인 경우 null 반환
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return null;
    }

    // ip-api.com 무료 API 사용 (JSON 형식)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode,country,message`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: IpApiResponse = await response.json();

    if (data.status === 'success' && data.countryCode) {
      return data.countryCode;
    }

    return null;
  } catch (error) {
    // 에러 발생 시 null 반환 (회원가입은 계속 진행)
    console.error('Failed to detect country from IP:', error);
    return null;
  }
}

/**
 * Express Request에서 클라이언트 IP 주소를 추출합니다.
 * @param req - Express Request 객체
 * @returns 클라이언트 IP 주소
 */
export function getClientIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string {
  // req.ip가 설정되어 있는 경우 (trust proxy 설정 필요)
  if (req.ip) {
    return req.ip;
  }

  // X-Forwarded-For 헤더 확인 (프록시/로드밸런서 뒤에 있는 경우)
  const forwardedFor = req.headers?.['x-forwarded-for'];
  if (forwardedFor) {
    if (typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0].trim();
    }
    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      return forwardedFor[0].split(',')[0].trim();
    }
  }

  // X-Real-IP 헤더 확인
  const realIp = req.headers?.['x-real-ip'];
  if (realIp) {
    return typeof realIp === 'string' ? realIp : realIp[0];
  }

  // 기본값
  return 'unknown';
}
