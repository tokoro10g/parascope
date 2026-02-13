import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { api, type Lock } from '../../../core/api';
import { useAuth } from '../../../core/contexts/AuthContext';

export function useSheetLock(sheetId: string | null, shouldLock = true) {
  const { user } = useAuth();
  const [lock, setLock] = useState<Lock | null>(null);
  const [isLockedByMe, setIsLockedByMe] = useState(false);
  const [lockedByOther, setLockedByOther] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [tabId] = useState(() => {
    let id = sessionStorage.getItem('parascope_tab_id');
    const windowName = window.name;

    // Check if this is a duplicated tab (target="_blank") or a genuine refresh
    // New tabs/windows usually have an empty window.name by default
    const isNewTab = !windowName || (id && windowName !== id);

    if (!id || isNewTab) {
      id = uuidv4();
      sessionStorage.setItem('parascope_tab_id', id);
      window.name = id;
    } else {
      // Ensure window.name is consistent (e.g. if it was cleared externally)
      if (window.name !== id) window.name = id;
    }
    return id;
  });

  const intervalRef = useRef<number | null>(null);

  // Separate function to just check status (not acquire)
  const checkStatus = useCallback(async () => {
    if (!sheetId || !user) return;
    try {
      const l = await api.getLock(sheetId);
      if (l) {
        if (l.user_id === user) {
          if (l.tab_id === tabId) {
            // We own it
            setLock(l);
            setIsLockedByMe(true);
            setLockedByOther(null);
          } else {
            // We own it in another tab
            setLockedByOther('You (another tab)');
            setIsLockedByMe(false);
          }
        } else {
          setLockedByOther(l.user_id);
          setIsLockedByMe(false);
        }
      } else {
        // No lock exists - Sheet is free.
        setLockedByOther(null);
        // Important: We do NOT set isLockedByMe(true) here.
        // We stay in read-only mode until they reload or explicitly act.
      }
    } catch (e) {
      console.error('Lock status check failed', e);
    } finally {
      setLoading(false);
    }
  }, [sheetId, user, tabId]);

  const heartbeat = useCallback(async () => {
    if (!sheetId || !user) return;

    // If strictly read-only mode (shouldLock=false), just check status
    if (!shouldLock) {
      checkStatus();
      return;
    }

    // If not locked by me, we just check status to see if it becomes free/changed
    // We do NOT attempt to acquire it even if it becomes free.
    // The user must reload or manually "Take Over" (which acts as acquire if free).
    if (!isLockedByMe) {
      checkStatus();
      return;
    }

    try {
      const l = await api.acquireLock(sheetId, tabId);
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
        console.error('Lock heartbeat failed', _e); // If acquire fails with other error (e.g. 403 Forbidden because lock was stolen/expired),
        // we should assume we lost the lock.
        // It's safer to downgrade to read-only if we can't confirm ownership.
        if (!isLockedByMe) {
          // If we were polling status and it failed, keep as is
        } else {
          // If we THOUGHT we had the lock but heartbeating failed,
          // check status to confirm if we really lost it.
          checkStatus();
        }
      }
    }
  }, [sheetId, user, isLockedByMe, checkStatus, tabId, shouldLock]);

  // Use a ref for heartbeat to access latest state without triggering effect re-run
  const heartbeatRef = useRef(heartbeat);
  useEffect(() => {
    heartbeatRef.current = heartbeat;
  }, [heartbeat]);

  // Main lifecycle effect for the lock session
  useEffect(() => {
    if (!sheetId || !user) return;

    if (!shouldLock) {
      checkStatus();
      return;
    }

    // 1. Initial acquire
    const initialAcquire = async () => {
      setLoading(true);

      // Optimization: Peek first to avoid 409 error noise in console/network tab if we know it's locked
      try {
        const existing = await api.getLock(sheetId);
        if (existing) {
          if (existing.user_id !== user || existing.tab_id !== tabId) {
            setLockedByOther(
              existing.user_id === user
                ? 'You (another tab)'
                : existing.user_id,
            );
            setIsLockedByMe(false);
            setLoading(false);
            return; // Don't try to acquire if we know it's locked
          }
        }
      } catch (e) {
        // Ignore peek error, proceed to acquire attempt
        console.warn('Peek lock failed', e);
      }

      try {
        const l = await api.acquireLock(sheetId, tabId);
        setLock(l);
        setIsLockedByMe(l.user_id === user);
      } catch (e: any) {
        if (e.message?.includes('Locked by')) {
          checkStatus();
        }
      } finally {
        setLoading(false);
      }
    };
    initialAcquire();

    // 2. Start polling using the ref
    const id = window.setInterval(() => {
      heartbeatRef.current();
    }, 10000); // 10s
    intervalRef.current = id;

    const handleBeforeUnload = () => {
      api.releaseLock(sheetId, tabId, { keepalive: true }).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 3. Cleanup: Stop polling AND Release lock
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // We only release when the user actually leaves the sheet (component unmounts or sheetId changes)
      // verify isLockedByMeRef or similar if needed, but backend checks ownership safely.
      api.releaseLock(sheetId, tabId).catch(() => {});
    };
  }, [sheetId, user, checkStatus, tabId, shouldLock]); // Strict dependency on Sheet ID, User, and checkStatus.

  const takeOver = async () => {
    if (!sheetId) return;
    try {
      const l = await api.forceTakeoverLock(sheetId, tabId);
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
      const l = await api.acquireLock(sheetId, tabId);
      setLock(l);
      setIsLockedByMe(true);
      setLockedByOther(null);
    } catch (_e) {
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
    isLoading: loading,
  };
}
