import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { uploadSingleAttachment } from '@/src/shared/lib/uploads';
import { Avatar } from '@/src/shared/ui/Avatar';
import { usePalette } from '@/src/stores/theme-store';
import { radius, typography } from '@/src/theme';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface AvatarPickerProps {
  value?: string | null;
  name?: string | null;
  size?: number;
  shape?: 'circle' | 'rounded';
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onChange?: (url: string | null) => void | Promise<void>;
}

export function AvatarPicker({
  disabled = false,
  label,
  name,
  onChange,
  shape = 'circle',
  size = 72,
  style,
  value,
}: AvatarPickerProps) {
  const colors = usePalette();
  const [uploading, setUploading] = useState(false);

  async function processPickedImage(pickerResult: ImagePicker.ImagePickerResult) {
    if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) {
      return;
    }

    const asset = pickerResult.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_BYTES) {
      Alert.alert('Photo too large', 'Please select an image smaller than 5MB.');
      return;
    }

    try {
      setUploading(true);
      const uploadedUrl = await uploadSingleAttachment(asset.uri);
      await onChange?.(uploadedUrl);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Please check your connection and try again.';
      Alert.alert('Unable to upload photo', msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleLaunchCamera() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Camera access is required to take a photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      await processPickedImage(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not open camera.';
      Alert.alert('Camera error', msg);
    }
  }

  async function handleLaunchLibrary() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Photo library access is required to choose a picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      await processPickedImage(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not open photos.';
      Alert.alert('Gallery error', msg);
    }
  }

  async function handleRemove() {
    try {
      setUploading(true);
      await onChange?.(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not remove photo.';
      Alert.alert('Error', msg);
    } finally {
      setUploading(false);
    }
  }

  function handlePress() {
    if (disabled || uploading) return;

    const hasPhoto = Boolean(value && value.trim().length > 0);

    const buttons: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }> = [
      { text: 'Take photo', onPress: () => void handleLaunchCamera() },
      { text: 'Choose from library', onPress: () => void handleLaunchLibrary() },
    ];

    if (hasPhoto) {
      buttons.push({
        text: 'Remove photo',
        style: 'destructive',
        onPress: () => void handleRemove(),
      });
    }

    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Profile photo', 'Update or remove picture', buttons);
  }

  const badgeSize = Math.max(22, Math.round(size * 0.32));
  const badgeIconSize = Math.max(12, Math.round(badgeSize * 0.58));

  return (
    <View style={[styles.root, style]}>
      <Pressable
        disabled={disabled || uploading}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.avatarPressable,
          { width: size, height: size },
          pressed && !disabled && !uploading && styles.pressed,
        ]}>
        <Avatar
          uri={value}
          name={name}
          size={size}
          shape={shape}
        />

        {uploading ? (
          <View style={[styles.overlay, { borderRadius: shape === 'circle' ? size / 2 : radius.md }]}>
            <ActivityIndicator size="small" color="#ffffff" />
          </View>
        ) : (
          <View
            style={[
              styles.badge,
              {
                width: badgeSize,
                height: badgeSize,
                borderRadius: badgeSize / 2,
                backgroundColor: colors.primary,
                borderColor: colors.surface,
              },
            ]}>
            <MaterialCommunityIcons
              name={value ? 'camera-flip-outline' : 'camera-plus-outline'}
              size={badgeIconSize}
              color={colors.onPrimary || '#ffffff'}
            />
          </View>
        )}
      </Pressable>

      {label ? (
        <Pressable disabled={disabled || uploading} onPress={handlePress}>
          <Text style={[styles.labelText, { color: colors.primary }]}>{label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: 6,
  },
  avatarPressable: {
    position: 'relative',
  },
  pressed: {
    opacity: 0.8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  labelText: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
});
