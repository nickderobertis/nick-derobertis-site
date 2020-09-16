// See: https://developers.google.com/gtagjs/reference/event#view_item_item
export interface IItem {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  coupon?: string;
  list_name?: string;
  list_position?: number;
  price?: number;
  quantity?: number;
  variant?: string;
}
