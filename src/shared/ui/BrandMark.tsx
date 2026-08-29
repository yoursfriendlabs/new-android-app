import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

interface BrandMarkProps {
  size?: number;
  variant?: 'icon' | 'mark';
  style?: StyleProp<ImageStyle>;
}

export function BrandMark({ size = 40, style, variant = 'icon' }: BrandMarkProps) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={variant === 'mark' ? require('@/assets/images/logo-mark.png') : require('@/assets/images/icon.png')}
      style={[styles.image, { width: size, height: size, borderRadius: variant === 'icon' ? size * 0.28 : 0 }, style]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: 'transparent',
  },
});
