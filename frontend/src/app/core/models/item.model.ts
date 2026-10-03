export type ItemId = 'headband' | 'party-hat' | 'nightcap' | 'chef-hat' | 'crown' | 'sunglasses';
export type ItemSlot = 'head' | 'face';

export interface PetItem {
  id: ItemId;
  name: string;
  icon: string;
  slot: ItemSlot;
  /** How to unlock it, shown in the wardrobe. */
  requirement: string;
  target: number;
}

export interface PetItemProgress extends PetItem {
  progress: number;
  unlocked: boolean;
}

export type EquippedItems = Partial<Record<ItemSlot, ItemId>>;
