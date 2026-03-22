# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Streeps** is a social drink-tally app (Dutch: "streepjes-app") for friend groups. Members track drinks via tallies, and the app calculates fair settlements via Tikkie. Cross-platform (Android/iOS) via Expo + React Native, with Supabase for backend/real-time.

## Tech Stack

- **Frontend**: Expo (React Native) with TypeScript
- **Backend**: Supabase (Postgres, Auth, Realtime, Edge Functions)
- **Navigation**: Expo Router (file-based routing)
- **State**: React Context + Supabase Realtime subscriptions
- **Styling**: React Native StyleSheet (dark theme, brand colors from logos)
- **Payments**: Tikkie API integration for settlement links

## Core Domain Concepts

- **Group**: a friend group with members and admins. Admins can modify tallies for all members, view history, and filter by active members.
- **Drink Category** (`categorie`): "normaal" or "speciaal", each with a configurable price per tally.
- **Drink** (`drank`): a specific drink (e.g. "bier", "0.0", "wijn") belonging to a category.
- **Tally** (`streepje`): a record of one drink for one person, timestamped. Self-service: members add their own tallies and show confirmation to bartender/friends.
- **Active status**: members mark themselves as "present" so admins can filter the view to only active people.
- **Settlement** (`afrekening`): auto-calculated from tallies × category price. Generates Tikkie payment links.

## Key Architecture Decisions

- All data flows through Supabase Realtime so every phone sees updates instantly.
- Row Level Security (RLS) on Supabase enforces: members see only their groups, admins get write access to other members' tallies, regular members can only add/view their own.
- Order history is an immutable log — tallies are soft-deleted (marked removed by admin), never hard-deleted, to preserve audit trail.
- The app language is Dutch for UI text.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Run on Android emulator/device
npx expo run:android

# Run on iOS simulator (macOS only)
npx expo run:ios

# Run tests
npm test

# Run a single test file
npm test -- --testPathPattern=<filename>

# Lint
npm run lint

# TypeScript type check
npx tsc --noEmit

# Generate Supabase types (after schema changes)
npx supabase gen types typescript --project-id <project-id> > src/types/supabase.ts
```

## Project Structure (planned)

```
src/
  app/              # Expo Router screens (file-based routing)
    (auth)/          # Login/register screens
    (tabs)/          # Main tab navigation
      groups/        # Group list, group detail, tally view
      history/       # Order/tally history
      settings/      # Profile, group settings
  components/        # Reusable UI components
  lib/
    supabase.ts      # Supabase client init
    tikkie.ts        # Tikkie API helpers
  hooks/             # Custom React hooks (useGroup, useTallies, useRealtime)
  types/             # TypeScript types, Supabase generated types
  constants/         # Colors, config, drink categories
  contexts/          # React Context providers (Auth, Group, ActiveStatus)
```
