export type ReminderType = "interval" | "fixed_time";

export interface ReminderConfig {
  id: string;
  type: ReminderType;
  /**
   * For "interval": number (in minutes)
   * For "fixed_time": string ("HH:mm")
   */
  value: number | string;
  message: string;
}

export interface StatusItemConfig {
  id: string;
  label: string;
  icon: string;
  onEnterMessage: string;
  reminders: ReminderConfig[];
}

export interface UserStatusConfig {
  statuses: StatusItemConfig[];
}
