export interface ProviderStatus {
  name: string;
  binary: string;
  is_installed: boolean;
  path: string | null;
}

export type CharacterName = "ethan" | "luna";
export type CharacterSize = "small" | "medium" | "large";
