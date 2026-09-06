import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { parseISO } from 'date-fns';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BsDatePickerModal } from '@/src/shared/forms/BsDatePickerModal';
import { adDateToBs } from '@/src/shared/lib/nepali-date';
import { localIsoDate, prettyDate, todayIso } from '@/src/shared/lib/format';
import { useDateFormat } from '@/src/stores/date-format-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

export interface DatePickerFieldProps {
  label?: string;
  value: string; // ISO date string (YYYY-MM-DD)
  onChangeText: (isoDate: string) => void;
  error?: string;
  helperText?: string;
  editable?: boolean;
}

export function DatePickerField({
  editable = true,
  error,
  helperText,
  label = 'Date',
  onChangeText,
  value,
}: DatePickerFieldProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const dateFormat = useDateFormat();
  const [bsModalVisible, setBsModalVisible] = useState(false);
  const [adPickerVisible, setAdPickerVisible] = useState(false);

  const effectiveIsoDate = value ? value.slice(0, 10) : todayIso();

  const formattedDisplay = useMemo(() => {
    if (!effectiveIsoDate) return 'Select date';
    if (dateFormat === 'BS') {
      return adDateToBs(effectiveIsoDate);
    }
    return prettyDate(effectiveIsoDate, 'AD');
  }, [dateFormat, effectiveIsoDate]);

  const parsedDate = useMemo(() => {
    try {
      return parseISO(effectiveIsoDate);
    } catch {
      return new Date();
    }
  }, [effectiveIsoDate]);

  function handlePress() {
    if (!editable) return;
    if (dateFormat === 'BS') {
      setBsModalVisible(true);
    } else {
      setAdPickerVisible(true);
    }
  }

  function handleAdDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setAdPickerVisible(false);
    }
    if (event.type === 'dismissed' || !selectedDate) {
      setAdPickerVisible(false);
      return;
    }
    const isoString = localIsoDate(selectedDate);
    onChangeText(isoString);
    if (Platform.OS === 'ios') {
      setAdPickerVisible(false);
    }
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text> : null}
      <Pressable
        onPress={handlePress}
        disabled={!editable}
        style={[
          styles.inputWrap,
          {
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: error ? colors.dangerSoft : !editable ? colors.surfaceMuted : colors.surface,
          },
        ]}>
        <MaterialCommunityIcons
          name={dateFormat === 'BS' ? 'calendar-star' : 'calendar-month-outline'}
          size={20}
          color={colors.primary}
          style={styles.leadingIcon}
        />
        <View style={styles.textWrap}>
          <Text style={[styles.valueText, { color: colors.text }]}>{formattedDisplay}</Text>
          <Text style={[styles.formatBadge, { color: colors.textSoft }]}>
            ({dateFormat === 'BS' ? 'वि.सं.' : 'AD'})
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={colors.textSoft}
          style={styles.trailingIcon}
        />
      </Pressable>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {!error && helperText ? <Text style={[styles.helper, { color: colors.textSoft }]}>{helperText}</Text> : null}

      {/* BS Modal Picker */}
      <BsDatePickerModal
        visible={bsModalVisible}
        value={effectiveIsoDate}
        onChange={onChangeText}
        onClose={() => setBsModalVisible(false)}
      />

      {/* AD Native Date Picker */}
      {adPickerVisible ? (
        <DateTimePicker
          value={parsedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleAdDateChange}
        />
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.xs,
    },
    label: {
      fontSize: typography.label,
      fontWeight: '600',
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      borderRadius: radius.input,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
    },
    leadingIcon: {
      marginRight: 2,
    },
    textWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    valueText: {
      fontSize: typography.body,
      fontWeight: '600',
    },
    formatBadge: {
      fontSize: 11,
      fontWeight: '700',
    },
    trailingIcon: {
      marginLeft: 'auto',
    },
    helper: {
      fontSize: typography.caption,
      lineHeight: 18,
    },
    error: {
      fontSize: typography.caption,
      fontWeight: '600',
      lineHeight: 18,
    },
  });
