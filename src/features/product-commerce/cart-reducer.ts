import type { CartItem, CatalogProduct } from './types';

export type CartAction =
  | { type: 'ADD_ITEM'; product: CatalogProduct; quantity?: number }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'UPDATE_QUANTITY'; id: string; delta: number }
  | { type: 'CLEAR' };

export function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.find(i => i.product.id === action.product.id);
      const qty = action.quantity ?? 1;
      if (existing) return state.map(i =>
        i.product.id === action.product.id ? { ...i, quantity: i.quantity + qty } : i,
      );
      return [...state, { product: action.product, quantity: qty }];
    }
    case 'REMOVE_ITEM':
      return state.filter(i => i.product.id !== action.id);
    case 'UPDATE_QUANTITY': {
      if (action.delta === 0) return state;
      return state
        .map(i =>
          i.product.id === action.id
            ? { ...i, quantity: Math.max(0, i.quantity + action.delta) }
            : i,
        )
        .filter(i => i.quantity > 0);
    }
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}
