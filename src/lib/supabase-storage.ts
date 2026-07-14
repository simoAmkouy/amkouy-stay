import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

/**
 * `window.localStorage` guarded by a `typeof window` check — safe to call during Expo
 * Router's Node-side static web render (where `window` doesn't exist), unlike calling
 * `window.localStorage` directly, which is what previously crashed the SSR pass.
 */
const webStorage: StorageAdapter = {
  getItem: async (key) => (typeof window === 'undefined' ? null : window.localStorage.getItem(key)),
  setItem: async (key, value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  },
};

/** AsyncStorage on native, SSR-safe localStorage shim on web — see supabase.ts for why this matters. */
export const supabaseStorage: StorageAdapter = Platform.OS === 'web' ? webStorage : AsyncStorage;
