import { MoodLabels } from './journal.model';
import { DEFAULT_SPEECH, Speech } from './speech.model';

export type PetColor = 'blue' | 'lilac' | 'honey';

export const PET_COLORS: Record<PetColor, { label: string; hex: string }> = {
  blue: { label: 'Niebieski', hex: '#5b93c0' },
  lilac: { label: 'Liliowy', hex: '#9a88c6' },
  honey: { label: 'Miodowy', hex: '#d9a04e' },
};

export interface Settings {
  onboarded: boolean;
  petName: string;
  petColor: PetColor;
  speech: Speech;
  moodLabels: MoodLabels;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  petName: 'Pimpek',
  petColor: 'blue',
  speech: DEFAULT_SPEECH,
  moodLabels: {},
};
