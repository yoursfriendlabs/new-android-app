import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { usePalette } from '@/src/stores/theme-store';
import { radius, typography } from '@/src/theme';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface ProductImagePickerProps {
  value?: string | null;
  name?: string | null;
  size?: number;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onChange?: (url: string | null) => void | Promise<void>;
}

export function ProductImagePicker({
  disabled = false,
  label = 'Product photo',
  name,
  onChange,
  size = 100,
  style,
  value,
}: ProductImagePickerProps) {
  const colors = usePalette();
  const [uploading, setUploading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const toast = useToast();
  const [hasError, setHasError] = useState(false);

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
      setHasError(false);
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

  const validUri = value && typeof value === 'string' && value.trim().length > 0;
  const badgeSize = Math.max(26, Math.round(size * 0.28));
  const badgeIconSize = Math.max(14, Math.round(badgeSize * 0.56));

  return (
    <View style={[styles.root, style]}>
      <Pressable
        disabled={disabled || uploading}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.previewContainer,
          {
            width: size,
            height: size,
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
          },
          pressed && !disabled && !uploading && styles.pressed,
        ]}>
        {validUri && !hasError ? (
          <Image
            source={{ uri: value.trim() }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setHasError(true)}
          />
        ) : (
          <View style={styles.placeholder}>
            <MaterialCommunityIcons
              name="package-variant-closed"
              size={Math.round(size * 0.42)}
              color={colors.textMuted}
            />
            <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
              {validUri && hasError ? 'Failed to load' : 'Add image'}
            </Text>
          </View>
        )}

        {uploading ? (
          <View style={styles.overlay}>
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
              name={validUri ? 'camera-flip-outline' : 'camera-plus-outline'}
              size={badgeIconSize}
              color={colors.onPrimary}
            />
          </View>
        )}
      </Pressable>

      <Pressable disabled={disabled || uploading} onPress={handlePress}>
        <Text style={[styles.labelText, { color: colors.primary }]}>
          {validUri ? 'Change photo' : label}
        </Text>
      </Pressable>

      <ActionSheet
        visible={pickerVisible}
        title="Product photo"
        subtitle="Upload or change the product picture"
        actions={pickerActions}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  previewContainer: {
    position: 'relative',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 6,
  },
  placeholderText: {
    fontSize: 10,
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
