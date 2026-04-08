import { StatusItemConfig } from "../types/userStatus";

export const DEFAULT_STATUS_CONFIG: StatusItemConfig[] = [
  {
    id: "working",
    label: "Working",
    icon: "💻",
    onEnterMessage: "Time to focus! Let's get things done. 💪",
    reminders: [
      { id: "r1", type: "interval", value: 45, message: "You've been sitting for a while, stand up and stretch! 🚶" },
      { id: "r2", type: "interval", value: 120, message: "Take a break, grab a glass of water! 🍵" }
    ]
  },
  {
    id: "offwork",
    label: "Off-work",
    icon: "🎉",
    onEnterMessage: "Work is done! Time to relax and enjoy. 🎉",
    reminders: []
  },
  {
    id: "eating",
    label: "Eating",
    icon: "🍱",
    onEnterMessage: "Time to eat! Enjoy your meal! 🍱",
    reminders: []
  }
];

export const MESSAGE_DISPLAY_DURATION_MS = {
  DEFAULT: 8000,
  REMINDER: 10000,
};
