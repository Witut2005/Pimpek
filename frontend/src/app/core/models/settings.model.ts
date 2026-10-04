export type PetColor = 'blue' | 'lilac' | 'honey';

export const PET_COLORS: Record<PetColor, { label: string; hex: string }> = {
  blue: { label: 'Niebieski', hex: '#5b93c0' },
  lilac: { label: 'Liliowy', hex: '#9a88c6' },
  honey: { label: 'Miodowy', hex: '#d9a04e' },
};

export interface Reminders {
  enabled: boolean;
  checkInTime: string;
  quietNights: boolean;
  /** We only ask after the first entry, never on the first screen. */
  asked: boolean;
}

/** Height and weight the user gave, for the BMI. Null until they fill them in. */
export interface Body {
  heightCm: number | null;
  weightKg: number | null;
}

export interface Settings {
  onboarded: boolean;
  petName: string;
  petColor: PetColor;
  body: Body;
  reminders: Reminders;
}

export const DEFAULT_BODY: Body = { heightCm: null, weightKg: null };

/** Body mass index (kg/m²) rounded to one decimal, or null when height or weight is missing. */
export function bmi(body: Body): number | null {
  if (!body.heightCm || !body.weightKg) return null;
  const meters = body.heightCm / 100;
  return Math.round((body.weightKg / (meters * meters)) * 10) / 10;
}

/** The usual WHO bands. Only shown next to the number, never used to judge the user. */
export function bmiCategory(value: number): string {
  if (value < 18.5) return 'poniżej normy';
  if (value < 25) return 'w normie';
  if (value < 30) return 'nadwaga';
  return 'otyłość';
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  petName: 'Pimpek',
  petColor: 'blue',
  body: DEFAULT_BODY,
  reminders: {
    enabled: false,
    checkInTime: '21:00',
    quietNights: true,
    asked: false,
  },
};
