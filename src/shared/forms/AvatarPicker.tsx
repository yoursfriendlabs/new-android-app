import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { ActionSheet, type ActionSheetItem } from '@/src/shared/feedback/ActionSheet';
import { useToast } from '@/src/shared/feedback/ToastProvider';
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
  const [pickerVisible, setPickerVisible] = useState(false);
  const toast = useToast();

  async function processPickedImage(pickerResult: ImagePicker.ImagePickerResult) {
    if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) {
      return;
    }

    const asset = pickerResult.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_BYTES) {
      toast.error('Pick an image smaller than 5MB.');
      return;
    }

    try {
      setUploading(true);
      const uploadedUrl = await uploadSingleAttachment(asset.uri);
      await onChange?.(uploadedUrl);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Please check your connection and try again.';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleLaunchCamera() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        toast.error('Camera access is needed to take a photo.');
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
      toast.error(msg);
    }
  }

  async function handleLaunchLibrary() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.error('Photo library access is needed to choose a picture.');
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
      toast.error(msg);
    }
  }

  async function handleRemove() {
    try {
      setUploading(true);
      await onChange?.(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not remove photo.';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  function handlePress() {
    if (disabled || uploading) return;
    setPickerVisible(true);
  }

  const pickerActions: ActionSheetItem[] = [
    { id: 'camera', label: 'Take photo', icon: 'camera-outline', onPress: () => void handleLaunchCamera() },
    { id: 'library', label: 'Choose from library', icon: 'image-outline', onPress: () => void handleLaunchLibrary() },
    ...(value && value.trim().length > 0
      ? [
          {
            id: 'remove',
            label: 'Remove photo',
            icon: 'trash-can-outline' as const,
            tone: 'danger' as const,
            onPress: () => void handleRemove(),
          },
        ]
      : []),
  ];

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
            <ActivityIndicator size="small" color={colors.onPrimary} />
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
              color={colors.onPrimary}
            />
          </View>
        )}
      </Pressable>

      {label ? (
        <Pressable disabled={disabled || uploading} onPress={handlePress}>
          <Text style={[styles.labelText, { color: colors.primary }]}>{label}</Text>
        </Pressable>
      ) : null}

      <ActionSheet
        visible={pickerVisible}
        title="Profile photo"
        subtitle="Update or remove your picture"
        actions={pickerActions}
        onClose={() => setPickerVisible(false)}
      />
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
    ...StyleSheet.absoluteFill,
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
