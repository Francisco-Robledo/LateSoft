import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../context/ThemeContext';
import { ScrollToTopButton, useScrollToTop } from './ScrollToTopButton';

interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  maxWidth?: number;
  showScrollToTop?: boolean;
}

export function Screen({
  children,
  scrollable = false,
  style,
  contentContainerStyle,
  maxWidth = 720,
  showScrollToTop = true,
}: ScreenProps) {
  const { width } = useWindowDimensions();
  const isWide = width > maxWidth;
  const { colors, isDark } = useTheme();
  const { scrollRef, showScrollTop, handleScroll, scrollToTop } = useScrollToTop(160);

  const innerContent = (
    <View style={[styles.inner, isWide && { maxWidth, width: '100%', alignSelf: 'center' }]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }, style]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {scrollable ? (
        <View style={styles.scrollWrapper}>
          <ScrollView
            ref={scrollRef}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {innerContent}
          </ScrollView>
          {showScrollToTop && (
            <ScrollToTopButton visible={showScrollTop} onPress={scrollToTop} />
          )}
        </View>
      ) : (
        innerContent
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollWrapper: {
    flex: 1,
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inner: {
    flex: 1,
  },
});
