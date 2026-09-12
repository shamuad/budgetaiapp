import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { authVectors } from '../../assets/auth/vectors';
import {
  AuthLogo,
  useAuthSystemBars,
  authColors,
  authFonts,
  flowText as t,
} from '../../src/components/auth/AuthUI';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useAuthSystemBars(true);
  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.scroll,
          {
            paddingTop: Math.max(56, insets.top + 16),
            paddingBottom: Math.max(32, insets.bottom + 8),
          },
        ]}
      >
        <View style={s.content}>
          <View style={s.header}>
            <AuthLogo white width={194} />
            <Text accessibilityRole="header" style={s.title}>
              {t('welcomeTitle')}
            </Text>
            <Text style={s.subtitle}>{t('welcomeSubtitle')}</Text>
          </View>
          <View style={s.illustration}>
            <Image
              source={require('../../assets/auth/growth.png')}
              style={s.growth}
              resizeMode="contain"
              accessible={false}
            />
          </View>
          <View style={s.benefits}>
            {(['accounts', 'family', 'insights'] as const).map((name) => (
              <View key={name} style={s.benefit}>
                <SvgXml xml={authVectors[name]} width={32} height={32} />
                <Text style={s.benefitText}>{t(`benefit_${name}`)}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={s.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(auth)/signup')}
            style={({ pressed }) => [s.start, pressed && { opacity: 0.8 }]}
          >
            <Text style={s.startText}>{t('getStarted')}</Text>
          </Pressable>
          <Link href="/(auth)/login" asChild>
            <Pressable accessibilityRole="link" style={s.signIn}>
              <Text style={s.existing}>
                {t('existingAccount')} <Text style={s.signInText}>{t('signIn')}</Text>
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: authColors.charcoal },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 40,
  },
  content: { width: '100%', maxWidth: 440 },
  header: { gap: 16 },
  title: {
    fontFamily: authFonts.medium,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.8,
    color: '#fff',
  },
  subtitle: { fontFamily: authFonts.regular, fontSize: 15, lineHeight: 23, color: '#C2BED3' },
  illustration: { marginTop: 32, height: 128, width: '100%' },
  growth: { position: 'absolute', width: '100%', height: 183, top: -39 },
  benefits: { gap: 16, marginTop: 16 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 40 },
  benefitText: {
    flex: 1,
    fontFamily: authFonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#fff',
  },
  footer: { width: '100%', maxWidth: 440, gap: 8 },
  start: {
    backgroundColor: authColors.mint,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  startText: { fontFamily: authFonts.medium, fontSize: 15, lineHeight: 22, color: '#101425' },
  signIn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  existing: {
    fontFamily: authFonts.regular,
    color: '#C2BED3',
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'center',
  },
  signInText: { fontFamily: authFonts.bold, fontSize: 15, color: '#99FFD0' },
});
