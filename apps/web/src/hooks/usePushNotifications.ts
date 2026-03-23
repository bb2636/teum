import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe } from './useProfile';
import { initPushNotifications } from '@/lib/push-notifications';

export function usePushNotifications() {
  const navigate = useNavigate();
  const { data: user } = useMe();
  const initialized = useRef(false);

  useEffect(() => {
    if (user && !initialized.current) {
      initialized.current = true;
      initPushNotifications(navigate);
    }
  }, [user, navigate]);
}
