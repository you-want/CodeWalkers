import { create } from 'zustand';
import { StatusItemConfig } from '../types/userStatus';
import { z } from 'zod';

export const ReminderSchema = z.object({
  id: z.string(),
  type: z.enum(['interval', 'fixed_time']),
  value: z.union([z.number(), z.string()]).refine((val) => {
    if (typeof val === 'number') return val > 0;
    if (typeof val === 'string') return /^([01]\d|2[0-3]):([0-5]\d)$/.test(val);
    return false;
  }, { message: "Please enter a valid interval in minutes or time (HH:mm)" }),
  message: z.string().min(1, "Reminder message cannot be empty")
});

export const StatusItemSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Status name cannot be empty").max(20, "Cannot exceed 20 characters"),
  icon: z.string().min(1, "Icon cannot be empty"),
  onEnterMessage: z.string().min(1, "Message cannot be empty").max(50, "Cannot exceed 50 characters"),
  reminders: z.array(ReminderSchema)
});

export const ConfigSchema = z.array(StatusItemSchema).min(1, "At least one status must be kept");

interface StatusSettingsState {
  isOpen: boolean;
  activeCharacterName: string | null;
  isLoading: boolean;
  error: string | null;
  config: StatusItemConfig[];
  selectedId: string | null;
  onSaveCallback: ((config: StatusItemConfig[]) => void) | null;
  
  open: (initialConfig: StatusItemConfig[], onSave: (config: StatusItemConfig[]) => void, characterName?: string) => void;
  close: () => void;
  submit: (newConfig: StatusItemConfig[]) => Promise<void>;
  reset: () => void;
  setConfig: (updater: (prev: StatusItemConfig[]) => StatusItemConfig[]) => void;
  setSelectedId: (id: string | null) => void;
}

const initialState = {
  isOpen: false,
  activeCharacterName: null,
  isLoading: false,
  error: null,
  config: [],
  selectedId: null,
  onSaveCallback: null,
};

export const useStatusSettingsStore = create<StatusSettingsState>((set, get) => ({
  ...initialState,

  open: (initialConfig, onSave, characterName) => set({
    isOpen: true,
    activeCharacterName: characterName || null,
    config: initialConfig,
    selectedId: initialConfig[0]?.id || null,
    onSaveCallback: onSave,
    error: null,
    isLoading: false,
  }),

  close: () => set({ isOpen: false }),

  reset: () => set(initialState),

  setConfig: (updater) => set((state) => ({ config: updater(state.config) })),
  
  setSelectedId: (id) => set({ selectedId: id }),

  submit: async (newConfig) => {
    set({ isLoading: true, error: null });
    
    // Simulate API delay with 500ms debounce as requested
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // Validate with Zod
      ConfigSchema.parse(newConfig);
      
      // Check if we should simulate random network errors
      // For this demo, let's keep it robust but demonstrate 422/500 if the label is specifically set to "error_500"
      const hasError500 = newConfig.some(s => s.label === 'error_500');
      if (hasError500) {
        throw new Error('500: Server Internal Error');
      }

      const hasError422 = newConfig.some(s => s.label === 'error_422');
      if (hasError422) {
        throw new Error('422: Unprocessable Entity');
      }

      const { onSaveCallback } = get();
      if (onSaveCallback) {
        onSaveCallback(newConfig);
      }
      
      set({ isLoading: false, isOpen: false });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        set({ error: "Validation failed: " + error.issues[0].message, isLoading: false });
      } else if (error instanceof Error) {
        set({ error: error.message || 'Network timeout, please try again', isLoading: false });
      } else {
        set({ error: 'Unknown error', isLoading: false });
      }
      throw error;
    }
  },
}));
