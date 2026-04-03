import { useEffect } from 'react';
import { forceFullCacheClear } from '@/lib/queryClient';

export function LoginRedirectPage() {
  useEffect(() => {
    forceFullCacheClear();
    sessionStorage.removeItem('teum_logged_out');
    sessionStorage.clear();
    localStorage.clear();

    const allowedPaths = ['/home', '/admin'];
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('to');
    const target = requested && allowedPaths.includes(requested) ? requested : '/home';

    setTimeout(() => {
      window.location.replace(target);
    }, 100);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#4A2C1A',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid rgba(255,255,255,0.3)',
          borderTopColor: 'white',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
