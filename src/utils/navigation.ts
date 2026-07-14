import { Href, router } from 'expo-router';

/**
 * How many distinct routes this app session has visited, tracked by the root
 * layout (see `registerRouteChange`). Starts at 1 for whatever URL the app
 * cold-launched on (including a direct deep link straight into a nested
 * detail screen) and increases by one on every subsequent in-app navigation.
 *
 * This exists because `router.canGoBack()` is NOT a reliable signal here:
 * on a fresh direct load into a nested tab+stack route (e.g. `/properties/[id]`
 * with no real prior navigation), Expo Router's web static rendering
 * reconstructs a navigation tree that makes `canGoBack()` report `true` even
 * though there is no real "previous screen" — and the subsequent
 * `router.back()` then lands on an arbitrary unrelated route instead of
 * failing loudly or going somewhere sensible. Gating on "has the user
 * actually navigated at least once this session" avoids that entirely.
 */
let routeChangeCount = 0;

export function registerRouteChange() {
  routeChangeCount += 1;
}

/**
 * Goes back if this screen was reached via real in-app navigation this
 * session; otherwise replaces the current screen with a known-good parent
 * route. Use this instead of `router.back()` on every back button, so a
 * screen opened directly — a deep link, a shared URL, a push notification,
 * a hard refresh on web — never throws "The action 'GO_BACK' was not
 * handled by any navigator" (or silently lands on the wrong screen).
 */
export function goBackOrReplace(fallbackHref: Href) {
  if (routeChangeCount > 1 && router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackHref);
  }
}
