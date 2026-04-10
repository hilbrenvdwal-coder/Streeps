import { supabase } from './supabase';
import * as db from './db';

type NewMessageCallback = (message: any, conversationId: string) => void;

export class ChatSyncManager {
  private userId: string | null = null;
  private channel: any = null;
  private callbacks: NewMessageCallback[] = [];
  private initialized = false;

  /**
   * Initialize the sync manager for the current user.
   * Runs an initial sync and starts realtime listeners.
   */
  async initialize(userId: string): Promise<void> {
    if (this.initialized && this.userId === userId) return;
    this.userId = userId;
    this.initialized = true;

    await this.initialSync();
  }

  /**
   * Initial sync: fetch messages created since last known sync timestamp.
   * If no previous sync, skip (full data loads via conversations/messages hooks).
   */
  async initialSync(): Promise<void> {
    if (!this.userId) return;

    const lastSync = db.getSyncMeta('last_sync_at');

    if (lastSync) {
      // Delta sync: fetch messages newer than our last sync
      try {
        const { data: newMessages } = await supabase
          .from('messages')
          .select('*')
          .gt('created_at', lastSync)
          .order('created_at', { ascending: true })
          .limit(500);

        if (newMessages && newMessages.length > 0) {
          // Fetch profiles for these messages
          const userIds = [...new Set(newMessages.map((m) => m.user_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', userIds);

          if (profiles) {
            db.upsertProfiles(profiles);
          }

          db.insertMessages(newMessages);

          // Update conversation previews for affected conversations
          const convIds = [...new Set(newMessages.map((m) => m.conversation_id))];
          for (const convId of convIds) {
            const latestForConv = newMessages
              .filter((m) => m.conversation_id === convId)
              .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
            if (latestForConv) {
              const senderProfile = db.getProfile(latestForConv.user_id);
              db.updateConversationPreview(
                convId,
                latestForConv.content,
                latestForConv.created_at,
                senderProfile?.full_name ?? null,
              );
            }
          }
        }
      } catch (e) {
        console.error('[SyncManager] initialSync delta failed:', e);
      }
    }

    // Update sync timestamp
    db.setSyncMeta('last_sync_at', new Date().toISOString());
  }

  /**
   * Start realtime listener for messages in given conversations.
   * Listens on all INSERT events on the messages table (filtered client-side).
   */
  startRealtime(conversationIds: string[]): void {
    // Clean up existing channel first
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    if (conversationIds.length === 0) return;

    this.channel = supabase
      .channel('sync-manager-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload: any) => {
          const newMsg = payload.new;
          if (!newMsg) return;

          try {
            // Fetch the full message with profile
            const { data: fullMsg } = await supabase
              .from('messages')
              .select('*')
              .eq('id', newMsg.id)
              .single();

            if (!fullMsg) return;

            // Get or fetch profile
            let profile = db.getProfile(fullMsg.user_id);
            if (!profile) {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .eq('id', fullMsg.user_id)
                .single();

              if (profileData) {
                db.upsertProfiles([profileData]);
                profile = profileData;
              }
            }

            // Insert message into SQLite
            db.insertMessages([fullMsg]);

            // Update conversation preview
            db.updateConversationPreview(
              fullMsg.conversation_id,
              fullMsg.content,
              fullMsg.created_at,
              profile?.full_name ?? null,
            );

            // Update sync timestamp
            db.setSyncMeta('last_sync_at', fullMsg.created_at);

            // Notify UI callbacks
            const enrichedMsg = {
              ...fullMsg,
              metadata: fullMsg.metadata
                ? typeof fullMsg.metadata === 'string'
                  ? tryParseJSON(fullMsg.metadata)
                  : fullMsg.metadata
                : null,
              profile: profile ? { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url } : null,
            };
            this.callbacks.forEach((cb) => cb(enrichedMsg, fullMsg.conversation_id));
          } catch (e) {
            console.error('[SyncManager] realtime handler error:', e);
          }
        },
      )
      .subscribe();
  }

  /**
   * Register a callback for new messages (used by UI hooks).
   * Returns an unsubscribe function.
   */
  onNewMessage(callback: NewMessageCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Delta sync: fetch messages after the latest local timestamp.
   * Called manually when the user returns to the app or pulls to refresh.
   */
  async deltaSync(): Promise<void> {
    if (!this.userId) return;

    const lastSync = db.getSyncMeta('last_sync_at');
    const since = lastSync || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    try {
      const { data: newMessages } = await supabase
        .from('messages')
        .select('*')
        .gt('created_at', since)
        .order('created_at', { ascending: true })
        .limit(500);

      if (newMessages && newMessages.length > 0) {
        // Fetch and cache profiles
        const userIds = [...new Set(newMessages.map((m) => m.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);
        if (profiles) db.upsertProfiles(profiles);

        db.insertMessages(newMessages);
      }

      db.setSyncMeta('last_sync_at', new Date().toISOString());
    } catch (e) {
      console.error('[SyncManager] deltaSync failed:', e);
    }
  }

  /**
   * Cleanup: stop realtime, optionally clear database.
   */
  cleanup(clearDatabase = false): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.callbacks = [];
    this.initialized = false;
    this.userId = null;

    if (clearDatabase) {
      db.clearAll();
    }
  }
}

// Singleton instance
export const chatSyncManager = new ChatSyncManager();

function tryParseJSON(str: string): any {
  try { return JSON.parse(str); } catch { return str; }
}
