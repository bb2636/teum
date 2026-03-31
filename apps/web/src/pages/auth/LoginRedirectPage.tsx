import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function LoginRedirectPage() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const doRedirect = async () => {
      try {
        await queryClient.cancelQueries();
      } catch {}
      queryClient.clear();
      queryClient.removeQueries();
      sessionStorage.removeItem('teum_logged_out');
      sessionStorage.clear();

      const allowedPaths = ['/home', '/admin'];
      const params = new URLSearchParams(window.location.search);
      const requested = params.get('to');
      const target = requested && allowedPaths.includes(requested) ? requested : '/home';

      setTimeout(() => {
        window.location.replace(target);
      }, 100);
    };

    doRedirect();
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#665146',
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
