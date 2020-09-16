export interface IEvent {
  action: string;
  category?: string;
  label?: string;
  value?: number;
  interaction?: boolean;
}
