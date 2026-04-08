import { t } from '@/lib/i18n';

export function MobileLoginCompletePage() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'sans-serif',
        background: '#4A2C1A',
        color: 'white',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '18px', marginBottom: '8px' }}>{t('auth.signupComplete')}</p>
        <p style={{ fontSize: '14px', opacity: 0.7 }}>{t('auth.closeThisWindow')}</p>
      </div>
    </div>
  );
}
