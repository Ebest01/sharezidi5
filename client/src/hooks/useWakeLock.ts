import { useRef, useCallback } from 'react';

export const useWakeLock = () => {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('[WakeLock] Screen wake lock activated');
        
        wakeLockRef.current.addEventListener('release', () => {
          console.log('[WakeLock] Screen wake lock released');
        });
        
        return true;
      } else {
        console.warn('[WakeLock] Wake Lock API not supported');
        return false;
      }
    } catch (error) {
      console.error('[WakeLock] Failed to request wake lock:', error);
      return false;
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('[WakeLock] Screen wake lock manually released');
      }
    } catch (error) {
      console.error('[WakeLock] Failed to release wake lock:', error);
    }
  }, []);

  const isWakeLockActive = useCallback(() => {
    return wakeLockRef.current && !wakeLockRef.current.released;
  }, []);

  return {
    requestWakeLock,
    releaseWakeLock,
    isWakeLockActive
  };
};