import { create } from 'zustand';
import { StatusItemConfig } from '../types/userStatus';
import { DEFAULT_STATUS_CONFIG } from '../constants/userStatus';

const CONFIG_STORAGE_KEY = 'codewalkers_status_config';

interface UserStatusState {
  configs: Record<string, StatusItemConfig[]>;
  activeStatusIds: Record<string, string | null>;
  statusMessages: Record<string, string | null>;
  
  initializeConfig: (characterName: string) => void;
  setConfig: (characterName: string, config: StatusItemConfig[]) => void;
  setActiveStatusId: (characterName: string, id: string | null) => void;
  setStatusMessage: (characterName: string, msg: string | null) => void;
}

const getInitialConfig = (characterName: string) => {
  const saved = localStorage.getItem(`${CONFIG_STORAGE_KEY}_${characterName}`);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(`Failed to parse status config for ${characterName}`, e);
    }
  }
  return DEFAULT_STATUS_CONFIG;
};

export const useUserStatusStore = create<UserStatusState>((set) => ({
  configs: {},
  activeStatusIds: {},
  statusMessages: {},

  initializeConfig: (characterName) => {
    set((state) => {
      if (state.configs[characterName]) return state; // already initialized
      return {
        configs: { ...state.configs, [characterName]: getInitialConfig(characterName) }
      };
    });
  },

  setConfig: (characterName, config) => {
    localStorage.setItem(`${CONFIG_STORAGE_KEY}_${characterName}`, JSON.stringify(config));
    set((state) => ({
      configs: { ...state.configs, [characterName]: config }
    }));
  },
  setActiveStatusId: (characterName, id) => set((state) => ({
    activeStatusIds: { ...state.activeStatusIds, [characterName]: id }
  })),
  setStatusMessage: (characterName, msg) => set((state) => ({
    statusMessages: { ...state.statusMessages, [characterName]: msg }
  })),
}));
