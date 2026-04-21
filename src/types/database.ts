// Domain types for Streeps - will be replaced by generated Supabase types later

// Categories are numbered 1-4, groups can name them whatever they want
export type DrinkCategory = 1 | 2 | 3 | 4;

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  price_category_1: number; // price per tally in cents
  price_category_2: number;
  price_category_3: number | null;
  price_category_4: number | null;
  name_category_1: string;
  name_category_2: string;
  name_category_3: string;
  name_category_4: string;
  auto_trust_members: boolean;
  drinks_as_categories: boolean;
  category_backup: any;
  created_at: string;
  created_by: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  is_admin: boolean;
  is_active: boolean; // currently present/active
  last_seen?: string; // heartbeat timestamp for auto-inactivity
  joined_at: string;
  profile?: Profile;
}

export interface Drink {
  id: string;
  group_id: string;
  name: string; // e.g. "Bier", "Wijn", "0.0"
  category: DrinkCategory;
  emoji: string | null;
  is_available: boolean;
  price_override: number | null;
  created_at: string;
}

export interface Tally {
  id: string;
  group_id: string;
  user_id: string;
  drink_id: string;
  added_by: string; // who added this tally (self or admin)
  removed: boolean;
  removed_by: string | null;
  removed_at: string | null;
  created_at: string;
  drink?: Drink;
  profile?: Profile;
}

export interface Settlement {
  id: string;
  group_id: string;
  created_by: string;
  total_amount: number; // in cents
  tikkie_url: string | null;
  settled_at: string | null;
  created_at: string;
}

export interface SettlementLine {
  id: string;
  settlement_id: string;
  user_id: string;
  amount: number; // in cents
  tally_count_1: number;
  tally_count_2: number;
  tally_count_3: number;
  tally_count_4: number;
  paid: boolean;
}

// Chat
export interface Conversation {
  id: string;
  type: 'dm' | 'group';
  group_id: string | null;
  created_at: string;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string;
  message_type?: 'text' | 'gift';
  metadata?: Record<string, any>;
  created_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
}

export interface TallyGift {
  id: string;
  group_id: string;
  giver_id: string;
  recipient_id: string;
  category: number;
  drink_id: string | null;
  quantity: number;
  redeemed: number;
  conversation_id: string | null;
  created_at: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
}
