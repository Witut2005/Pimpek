export interface Goals {
  sleepHours: number;
  steps: number;
  /** Still used for manual check-ins without a wearable. */
  runningKm: number;
  screenMaxHours: number;
}

export type PetColor = 'blue' | 'lilac' | 'honey';

export const PET_COLORS: Record<PetColor, { label: string; hex: string }> = {
  blue: { label: 'Niebieski', hex: '#5b93c0' },
  lilac: { label: 'Liliowy', hex: '#9a88c6' },
  honey: { label: 'Miodowy', hex: '#d9a04e' },
};

export interface Reminders {
  enabled: boolean;
  checkInTime: string;
  bedtimeNudge: boolean;
  bedtime: string;
  quietNights: boolean;
  /** We only ask after the first check-in, never on the first screen. */
  asked: boolean;
}

export interface Settings {
  onboarded: boolean;
  petName: string;
  petColor: PetColor;
  focus: string[];
  goals: Goals;
  reminders: Reminders;
  /** Pimpek never gets sick and messages stay soft. */
  gentleMode: boolean;
}

export const DEFAULT_GOALS: Goals = { sleepHours: 7.5, steps: 8000, runningKm: 3, screenMaxHours: 3 };

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  petName: 'Pimpek',
  petColor: 'blue',
  focus: [],
  goals: DEFAULT_GOALS,
  reminders: {
    enabled: false,
    checkInTime: '21:00',
    bedtimeNudge: true,
    bedtime: '23:00',
    quietNights: true,
    asked: false,
  },
  gentleMode: false,
};
