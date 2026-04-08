import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';

export function useHeartbeat(userId: string | undefined) {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!userId) return;

    // Heartbeat: update last_seen elke 5 minuten voor actieve groepen
    const heartbeatInterval = setInterval(async () => {
      await supabase
        .from('group_members')
        .update({ last_seen: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_active', true);
    }, 5 * 60 * 1000);

    // AppState listener
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (appState.current === 'active' && nextState === 'background') {
        // App gaat naar background -> deactiveer alle groepen
        await supabase
          .from('group_members')
          .update({ is_active: false })
          .eq('user_id', userId);
      }

      if (nextState === 'active' && appState.current !== 'active') {
        // App komt terug -> update last_seen
        await supabase
          .from('group_members')
          .update({ last_seen: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('is_active', true);
      }

      appState.current = nextState;
    });

    return () => {
      clearInterval(heartbeatInterval);
      subscription.remove();
    };
  }, [userId]);
}
