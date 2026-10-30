import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const { colors, isDark } = useTheme();

  const getContainerStyle = (): ViewStyle[] => {
    const list: ViewStyle[] = [styles.base, styles[size]];

    if (variant === 'primary') list.push(styles.primary);
    else if (variant === 'secondary') list.push(styles.secondary);
    else if (variant === 'outline') list.push(styles.outline);
    else if (variant === 'danger') list.push(styles.danger);

    if (isDark) {
      if (variant === 'primary') list.push({ backgroundColor: colors.primary });
      if (variant === 'secondary') list.push({ backgroundColor: colors.surfaceSecondary });
      if (variant === 'outline') list.push({ borderColor: colors.primary });
    }

    if (disabled || isLoading) list.push(styles.disabled);
    if (style) list.push(style);

    return list;
  };

  const getTextStyle = (): TextStyle[] => {
    const list: TextStyle[] = [styles.textBase, styles[`text_${size}` as keyof typeof styles] as TextStyle];

    if (variant === 'primary') list.push(styles.textPrimary);
    else if (variant === 'secondary') list.push(styles.textSecondary);
    else if (variant === 'outline') list.push(styles.textOutline);
    else if (variant === 'danger') list.push(styles.textDanger);

    if (isDark && variant === 'primary') list.push({ color: '#111827', fontWeight: '700' });
    if (isDark && variant === 'secondary') list.push({ color: colors.text });
    if (isDark && variant === 'outline') list.push({ color: colors.primary });

    if (disabled) list.push(styles.textDisabled);
    if (textStyle) list.push(textStyle);

    return list;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || isLoading}
      style={getContainerStyle()}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === 'outline' && isDark
              ? colors.primary
              : variant === 'primary' && isDark
              ? '#111827'
              : variant === 'outline'
              ? '#4A2E18'
              : '#FFFFFF'
          }
        />
      ) : (
        <>
          {icon}
          <Text style={getTextStyle()}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  small: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  medium: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  large: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  primary: {
    backgroundColor: '#6F4E37', // Tono cafe de especialidad
  },
  secondary: {
    backgroundColor: '#D4B996',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#6F4E37',
  },
  danger: {
    backgroundColor: '#C84B31',
  },
  disabled: {
    opacity: 0.5,
  },
  textBase: {
    fontWeight: '600',
    textAlign: 'center',
  },
  text_small: {
    fontSize: 13,
  },
  text_medium: {
    fontSize: 15,
  },
  text_large: {
    fontSize: 17,
  },
  textPrimary: {
    color: '#FFFFFF',
  },
  textSecondary: {
    color: '#2A1810',
  },
  textOutline: {
    color: '#6F4E37',
  },
  textDanger: {
    color: '#FFFFFF',
  },
  textDisabled: {
    color: '#A0A0A0',
  },
});
