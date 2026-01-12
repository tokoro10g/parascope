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

  const heartbeat = useCallback(async () => {
    if (!sheetId || !user) return;

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
  }, [sheetId, user]);

  useEffect(() => {
    if (!sheetId || !user) return;

    // Initial acquire
    heartbeat();

    // Start polling
    intervalRef.current = window.setInterval(heartbeat, 10000); // 10s

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Release lock if we own it
      // Note: We use the value from closure, this might be stale if Dependencies changed.
      // But dependency [sheetId] means effect rebuilds when sheet changes.
      // So releasing current sheetId is correct.
      // Ideally we check if we own it, but `releaseLock` backend checks ownership anyway.
      // So safe to call blindly.
      api.releaseLock(sheetId).catch(() => {});
    };
  }, [sheetId, user, heartbeat]);

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

  return {
    lock,
    isLockedByMe,
    lockedByOther,
    takeOver,
    refreshLock: heartbeat,
  };
}
