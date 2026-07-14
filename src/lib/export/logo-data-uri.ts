import { Asset } from 'expo-asset';

let cached: Promise<string> | null = null;

/**
 * Resolves the official Amkouy Immobilier logo (bundled at `assets/images/amkouy-logo.png`) to a
 * `data:` URI, so it can be inlined into the raw HTML strings handed to `expo-print` — a PDF's
 * HTML has no access to the Metro bundler's asset graph, so a plain `require()`/relative path
 * won't render on native. Resolved once per app session and cached, since the file never changes
 * at runtime.
 */
export function getLogoDataUri(): Promise<string> {
  if (!cached) {
    cached = (async () => {
      const asset = Asset.fromModule(require('@/assets/images/amkouy-logo.png'));
      await asset.downloadAsync();
      const response = await fetch(asset.localUri ?? asset.uri);
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    })();
  }
  return cached;
}
