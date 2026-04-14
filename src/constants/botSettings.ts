// Chatbot personality presets per groep — gedeeld tussen UI en edge function.
// De EERSTE optie per dimensie (index 0) matcht exact het huidige bot-gedrag,
// zodat default-groepen (bot_settings = {}) identiek blijven werken.

export type HumorOption = 'droog' | 'nuchter' | 'cheesy';
export type ToonOption = 'vriend' | 'vriendelijk' | 'savage';
export type TaalregisterOption = 'genz' | 'neutraal' | 'kroeg';
export type LengteOption = 'matched' | 'kort' | 'uitgebreid';
export type BetrokkenheidOption = 'reactief' | 'betrokken' | 'enthousiast';

export interface BotSettings {
  humor?: HumorOption;
  toon?: ToonOption;
  taalregister?: TaalregisterOption;
  lengte?: LengteOption;
  betrokkenheid?: BetrokkenheidOption;
  respond_to_gift_messages?: boolean;
}

export const BOT_DEFAULTS: Required<BotSettings> = {
  humor: 'droog',
  toon: 'vriend',
  taalregister: 'genz',
  lengte: 'matched',
  betrokkenheid: 'reactief',
  respond_to_gift_messages: false,
};

// Hard monthly limit — bij overschrijding reageert bot niet meer tot reset.
// Reset gebeurt automatisch op de 1e van elke maand via de bot_usage_month check
// in de edge function (vergelijk YYYY-MM, bij wijziging reset count naar 0).
export const BOT_MONTHLY_LIMIT = 150;

// Dimensie-definities voor UI-hergebruik (chips-rij).
// Volgorde binnen options: index 0 = default/huidig gedrag.
export type BotDimensionKey = 'humor' | 'toon' | 'taalregister' | 'lengte' | 'betrokkenheid';

export interface BotDimensionDef {
  key: BotDimensionKey;
  label: string;
  options: { key: string; label: string }[];
}

export const BOT_DIMENSIONS: BotDimensionDef[] = [
  {
    key: 'humor',
    label: 'Humor',
    options: [
      { key: 'droog', label: 'Droog' },
      { key: 'nuchter', label: 'Nuchter' },
      { key: 'cheesy', label: 'Cheesy' },
    ],
  },
  {
    key: 'toon',
    label: 'Toon',
    options: [
      { key: 'vriend', label: 'Die vriend' },
      { key: 'vriendelijk', label: 'Vriendelijk' },
      { key: 'savage', label: 'Savage' },
    ],
  },
  {
    key: 'taalregister',
    label: 'Taalregister',
    options: [
      { key: 'genz', label: 'Gen-Z' },
      { key: 'neutraal', label: 'Neutraal' },
      { key: 'kroeg', label: 'Kroeg' },
    ],
  },
  {
    key: 'lengte',
    label: 'Lengte',
    options: [
      { key: 'matched', label: 'Matcht energie' },
      { key: 'kort', label: 'Kort' },
      { key: 'uitgebreid', label: 'Uitgebreid' },
    ],
  },
  {
    key: 'betrokkenheid',
    label: 'Betrokkenheid',
    options: [
      { key: 'reactief', label: 'Reactief' },
      { key: 'betrokken', label: 'Betrokken' },
      { key: 'enthousiast', label: 'Enthousiast' },
    ],
  },
];

// Helper: merge user settings met defaults, met fallback voor onbekende waarden.
export function resolveBotSettings(settings: BotSettings | null | undefined): Required<BotSettings> {
  const merged = { ...BOT_DEFAULTS, ...(settings ?? {}) };

  // Validate enum values — onbekende waarden fallbacken naar default
  const humorValid: HumorOption[] = ['droog', 'nuchter', 'cheesy'];
  const toonValid: ToonOption[] = ['vriend', 'vriendelijk', 'savage'];
  const taalValid: TaalregisterOption[] = ['genz', 'neutraal', 'kroeg'];
  const lengteValid: LengteOption[] = ['matched', 'kort', 'uitgebreid'];
  const betrokValid: BetrokkenheidOption[] = ['reactief', 'betrokken', 'enthousiast'];

  if (!humorValid.includes(merged.humor)) merged.humor = BOT_DEFAULTS.humor;
  if (!toonValid.includes(merged.toon)) merged.toon = BOT_DEFAULTS.toon;
  if (!taalValid.includes(merged.taalregister)) merged.taalregister = BOT_DEFAULTS.taalregister;
  if (!lengteValid.includes(merged.lengte)) merged.lengte = BOT_DEFAULTS.lengte;
  if (!betrokValid.includes(merged.betrokkenheid)) merged.betrokkenheid = BOT_DEFAULTS.betrokkenheid;

  return merged;
}
