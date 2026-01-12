import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api, type Lock } from '../api';
import { useAuth } from '../contexts/AuthContext';

export function useSheetLock(sheetId: string | null) {
  const { user } = useAuth();
  const [lock, setLock] = useState<Lock | null>(null);
  const [isLockedByMe, setIsLockedByMe] = useState(false);
  const [lockedByOther, setLockedByOther] = useState<string | null>(null);

  const intervalRef = useRef<number | null>(null);

  // Separate function to just check status (not acquire)
  const checkStatus = useCallback(async () => {
    if (!sheetId || !user) return;
    try {
      const l = await api.getLock(sheetId);
      if (l) {
        if (l.user_id === user) {
          // Weird edge case: we own it but didn't know?
          // Recover ownership state
          setLock(l);
          setIsLockedByMe(true);
          setLockedByOther(null);
        } else {
          setLockedByOther(l.user_id);
          setIsLockedByMe(false);
        }
      } else {
        // No lock exists
        setLockedByOther(null);
        // We do NOT auto-acquire here.
      }
    } catch (e) {
      console.error('Lock status check failed', e);
    }
  }, [sheetId, user]);

  const heartbeat = useCallback(async () => {
    if (!sheetId || !user) return;

    // If not locked by me, we just check status to see if it becomes free/changed
    if (!isLockedByMe) {
      checkStatus();
      return;
    }

    try {
      const l = await api.acquireLock(sheetId);
      setLock(l);
      setIsLockedByMe(l.user_id === user);
      setLockedByOther(null);
    } catch (_e: any) {
      if (_e.message?.includes('Locked by')) {
        const match = _e.message.match(/Locked by (.+)/);
        const owner = match ? match[1] : 'Unknown';
        setLockedByOther(owner);
        setIsLockedByMe(false);
      } else {
        console.error('Lock heartbeat failed', _e);
      }
    }
  }, [sheetId, user, isLockedByMe, checkStatus]);

  // Initial load: try to acquire once.
  useEffect(() => {
    if (!sheetId || !user) return;

    const initialAcquire = async () => {
      try {
        const l = await api.acquireLock(sheetId);
        setLock(l);
        setIsLockedByMe(l.user_id === user);
      } catch (e: any) {
        if (e.message?.includes('Locked by')) {
          // Locked by someone else
          checkStatus();
        }
      }
    };
    initialAcquire();

    // Start polling
    intervalRef.current = window.setInterval(heartbeat, 10000); // 10s

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Only release if we think we own it. (Backend verifies anyway)
      api.releaseLock(sheetId).catch(() => {});
    };
  }, [sheetId, user]); // Removed heartbeat dependency to avoid reset loop, handled inside heartbeat ref

  const takeOver = async () => {
    if (!sheetId) return;
    try {
      const l = await api.forceTakeoverLock(sheetId);
      setLock(l);
      setIsLockedByMe(true);
      setLockedByOther(null);
      toast.success('You have taken over the lock.');
    } catch (_e: any) {
      toast.error('Failed to take over lock');
    }
  };

  const acquire = async () => {
    if (!sheetId) return;
    try {
      const l = await api.acquireLock(sheetId);
      setLock(l);
      setIsLockedByMe(true);
      setLockedByOther(null);
    } catch (e) {
      toast.error('Failed to acquire lock');
    }
  };

  return {
    lock,
    isLockedByMe,
    lockedByOther,
    takeOver,
    acquire,
    refreshLock: heartbeat,
  };
}
