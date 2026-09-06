import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { usePalette } from '@/src/stores/theme-store';

export interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  shape?: 'circle' | 'rounded' | 'square';
  borderRadius?: number;
  backgroundColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fallbackIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
}

export function getInitials(name?: string | null): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'P';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({
  backgroundColor,
  borderRadius,
  fallbackIcon,
  name,
  shape = 'circle',
  size = 44,
  style,
  textColor,
  textStyle,
  uri,
}: AvatarProps) {
  const colors = usePalette();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [uri]);

  const resolvedRadius =
    borderRadius !== undefined
      ? borderRadius
      : shape === 'circle'
        ? size / 2
        : shape === 'rounded'
          ? Math.max(8, Math.round(size * 0.32))
          : 0;

  const bg = backgroundColor || colors.primary;
  const fg = textColor || colors.onPrimary || '#ffffff';
  const fontSize = Math.max(10, Math.round(size * 0.38));

  const validUri = uri && typeof uri === 'string' && uri.trim().length > 0;

  if (validUri && !hasError) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: resolvedRadius,
            backgroundColor: colors.surfaceMuted,
          },
          style,
        ]}>
        <Image
          source={{ uri: uri.trim() }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: resolvedRadius,
            },
          ]}
          resizeMode="cover"
          onError={() => setHasError(true)}
        />
      </View>
    );
  }

  const initials = getInitials(name);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: resolvedRadius,
          backgroundColor: bg,
        },
        style,
      ]}>
      {fallbackIcon && !name ? (
        <MaterialCommunityIcons name={fallbackIcon} size={Math.round(size * 0.52)} color={fg} />
      ) : (
        <Text
          style={[
            styles.text,
            {
              fontSize,
              color: fg,
              lineHeight: fontSize + 2,
            },
            textStyle,
          ]}>
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  text: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});
