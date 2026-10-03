export type ItemId =
  | 'headband'
  | 'party-hat'
  | 'nightcap'
  | 'chef-hat'
  | 'crown'
  | 'sunglasses'
  | 'scarf'
  | 'bow-tie'
  | 'flower'
  | 'round-glasses';
export type ItemSlot = 'head' | 'face' | 'neck';

export interface PetItem {
  id: ItemId;
  name: string;
  icon: string;
  slot: ItemSlot;
  /** `reward` items are earned by habits, `shop` items are bought with leaves. */
  kind: 'reward' | 'shop';
  /** How to unlock it, shown in the wardrobe. */
  requirement: string;
  target: number;
  price?: number;
}

export interface PetItemProgress extends PetItem {
  progress: number;
  unlocked: boolean;
}

export type EquippedItems = Partial<Record<ItemSlot, ItemId>>;

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface BadgeProgress extends Badge {
  earned: boolean;
}
