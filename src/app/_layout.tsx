import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
  Roboto_900Black,
  useFonts,
} from '@expo-google-fonts/roboto';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, usePathname } from 'expo-router';
import { ReactNode, useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { LocaleProvider } from '@/hooks/use-locale';
import { usePermissions } from '@/hooks/use-permissions';
import { registerRouteChange } from '@/utils/navigation';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
    Roboto_900Black,
  });

  // Tracks real in-app navigation activity — see goBackOrReplace() in utils/navigation.ts
  // for why this is needed instead of trusting router.canGoBack() alone.
  useEffect(() => {
    registerRouteChange();
  }, [pathname]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocaleProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AnimatedSplashOverlay />
            <AuthGate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="login" />
                <Stack.Screen name="reset-password" />
                <Stack.Screen name="(tabs)" />
              </Stack>
            </AuthGate>
          </ThemeProvider>
        </LocaleProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * Protected-route gate: redirects to /login when there's no session (except on the login and
 * password-reset screens — the latter needs to render while Supabase's recovery-link session is
 * still being established), and to /dashboard when a session exists on the login screen.
 */
function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const { homeRoute } = usePermissions();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    const isAuthScreen = pathname === '/login' || pathname.startsWith('/reset-password');
    if (!session && !isAuthScreen) {
      router.replace('/login');
    } else if (session && pathname === '/login') {
      router.replace(homeRoute);
    }
  }, [session, loading, pathname, homeRoute]);

  if (loading) return null;
  return <>{children}</>;
}
