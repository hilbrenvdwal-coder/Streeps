import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface HistoryItem {
  id: string;
  group_name: string;
  category: number;
  created_at: string;
  removed: boolean;
}

export function useHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('tallies')
      .select(`
        id,
        category,
        created_at,
        removed,
        group:groups(name)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching history:', error);
      setLoading(false);
      return;
    }

    const items: HistoryItem[] = (data ?? []).map((t: any) => ({
      id: t.id,
      group_name: t.group?.name ?? '?',
      category: t.category ?? 1,
      created_at: t.created_at,
      removed: t.removed,
    }));

    setHistory(items);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, loading, refresh: fetchHistory };
}

export function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  const time = date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

  if (diffMin < 1) return 'zojuist';
  if (diffMin < 60) return `${diffMin} min geleden`;
  if (diffHours < 24) return `${diffHours} uur geleden · ${time}`;
  if (diffDays === 1) return `gisteren · ${time}`;
  if (diffDays < 7) return `${diffDays} dagen geleden · ${time}`;
  return `${date.toLocaleDateString('nl-NL')} · ${time}`;
}
