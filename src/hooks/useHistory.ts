import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface HistoryItem {
  id: string;
  group_name: string;
  category: number;
  created_at: string;
  removed: boolean;
  type: 'tally' | 'gift_sent' | 'gift_received';
  count?: number;
  gift_quantity?: number;
  gift_other_name?: string;
}

export function useHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!user) return;

    // Fetch tallies
    const { data: tallies, error } = await supabase
      .from('tallies')
      .select(`id, category, created_at, removed, group:groups(name)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching history:', error);
      setLoading(false);
      return;
    }

    // Group tallies by category + group + time window (within 60s = same batch)
    const tallyItems: HistoryItem[] = [];
    let prev: any = null;
    for (const t of (tallies ?? []) as any[]) {
      const gName = t.group?.name ?? '?';
      const cat = t.category ?? 1;
      const ts = new Date(t.created_at).getTime();
      if (prev && prev.category === cat && prev.group_name === gName
          && Math.abs(ts - prev.ts) < 60000 && !t.removed && !prev.removed) {
        // Same batch — increment count
        prev.count += 1;
      } else {
        prev = { id: t.id, group_name: gName, category: cat, created_at: t.created_at, removed: t.removed, type: 'tally' as const, count: 1, ts };
        tallyItems.push(prev);
      }
    }

    // Fetch gifts sent by me
    const { data: giftsSent } = await supabase
      .from('tally_gifts')
      .select('id, category, quantity, created_at, recipient_id, group:groups(name)')
      .eq('giver_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Fetch recipient names separately (FK goes to auth.users, not profiles)
    let recipientNames: Record<string, string> = {};
    if (giftsSent && giftsSent.length > 0) {
      const recipientIds = [...new Set(giftsSent.map((g: any) => g.recipient_id))];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', recipientIds);
      (profiles || []).forEach((p: any) => { recipientNames[p.id] = p.full_name; });
    }

    const sentItems: HistoryItem[] = (giftsSent ?? []).map((g: any) => ({
      id: `gift-sent-${g.id}`,
      group_name: g.group?.name ?? '?',
      category: g.category ?? 1,
      created_at: g.created_at,
      removed: false,
      type: 'gift_sent' as const,
      gift_quantity: g.quantity,
      gift_other_name: recipientNames[g.recipient_id] ?? '?',
    }));

    // Merge and sort by date (no received gifts — you don't pay for those)
    const all = [...tallyItems, ...sentItems]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    setHistory(all);
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
