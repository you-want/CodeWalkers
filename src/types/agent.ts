export interface ProviderStatus {
  name: string;
  binary: string;
  is_installed: boolean;
  path: string | null;
}

export type CharacterName = "bruce" | "jazz";
export type CharacterSize = "small" | "medium" | "large";
