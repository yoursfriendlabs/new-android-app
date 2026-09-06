import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';

import {
  adDateToBs,
  adDateToBsRaw,
  bsDateToAd,
  getBsMonthInfo,
  todayBsRaw,
  BS_MONTHS,
  BS_MONTHS_EN,
  BS_DAYS_SHORT,
  BS_DAYS_SHORT_EN,
} from '@/src/shared/lib/nepali-date';
import { useLanguageStore } from '@/src/stores/language-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

interface BsDatePickerModalProps {
  visible: boolean;
  value?: string; // AD ISO date e.g. "2026-09-05"
  onChange: (isoDate: string) => void;
  onClose: () => void;
  title?: string;
}

export function BsDatePickerModal({
  visible,
  value,
  onChange,
  onClose,
  title = 'मिति छान्नुहोस् (Select BS Date)',
}: BsDatePickerModalProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const isNepali = useLanguageStore((state) => state.language === 'ne');

  // Convert incoming AD date to BS
  const initialBs = useMemo(() => {
    try {
      const bsStr = value ? adDateToBsRaw(value) : todayBsRaw();
      const [y, m, d] = bsStr.split('-').map(Number);
      return {
        year: y || 2083,
        month: m || 1,
        day: d || 1,
      };
    } catch {
      return { year: 2083, month: 1, day: 1 };
    }
  }, [value]);

  const [currentYear, setCurrentYear] = useState(initialBs.year);
  const [currentMonth, setCurrentMonth] = useState(initialBs.month);
  const [selectedDay, setSelectedDay] = useState(initialBs.day);
  const [mode, setMode] = useState<'calendar' | 'yearPicker' | 'monthPicker'>('calendar');

  const monthInfo = useMemo(
    () => getBsMonthInfo(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const todayBs = useMemo(() => {
    const raw = todayBsRaw();
    const [y, m, d] = raw.split('-').map(Number);
    return { year: y, month: m, day: d };
  }, []);

  const monthNames = isNepali ? BS_MONTHS : BS_MONTHS_EN;
  const dayNames = isNepali ? BS_DAYS_SHORT : BS_DAYS_SHORT_EN;

  function handlePrevMonth() {
    void Haptics.selectionAsync();
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    void Haptics.selectionAsync();
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function handleSelectDay(day: number) {
    setSelectedDay(day);
    void Haptics.selectionAsync();
  }

  function handleConfirm() {
    const pad = (n: number) => String(n).padStart(2, '0');
    const bsIso = `${currentYear}-${pad(currentMonth)}-${pad(selectedDay)}`;
    const adIso = bsDateToAd(bsIso);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onChange(adIso);
    onClose();
  }

  function handleSelectToday() {
    setCurrentYear(todayBs.year);
    setCurrentMonth(todayBs.month);
    setSelectedDay(todayBs.day);
    void Haptics.selectionAsync();
  }

  function handleSelectYesterday() {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    const bsStr = adDateToBsRaw(`${year}-${month}-${day}`);
    const [y, m, d] = bsStr.split('-').map(Number);
    setCurrentYear(y);
    setCurrentMonth(m);
    setSelectedDay(d);
    void Haptics.selectionAsync();
  }

  // Available BS years range: 2075 to 2095
  const yearsList = useMemo(() => {
    const list = [];
    for (let y = 2070; y <= 2095; y++) {
      list.push(y);
    }
    return list;
  }, []);

  const totalGridCells = monthInfo.firstDayOfWeek + monthInfo.daysInMonth;
  const numRows = Math.ceil(totalGridCells / 7);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.headerKicker, { color: colors.primary }]}>
                {isNepali ? 'नेपाली पात्रो (वि.सं.)' : 'Nepali Calendar (B.S.)'}
              </Text>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {selectedDay} {monthNames[currentMonth - 1]} {currentYear}
              </Text>
            </View>
            <Pressable hitSlop={12} onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Quick Presets */}
          <View style={styles.presetRow}>
            <Pressable
              style={[styles.presetChip, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}
              onPress={handleSelectToday}>
              <MaterialCommunityIcons name="calendar-today" size={14} color={colors.primary} />
              <Text style={[styles.presetChipText, { color: colors.primary }]}>
                {isNepali ? 'आज (Today)' : 'Today'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.presetChip, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
              onPress={handleSelectYesterday}>
              <MaterialCommunityIcons name="history" size={14} color={colors.textMuted} />
              <Text style={[styles.presetChipText, { color: colors.text }]}>
                {isNepali ? 'हिजो (Yesterday)' : 'Yesterday'}
              </Text>
            </Pressable>
          </View>

          {/* Month / Year Navigator */}
          <View style={[styles.navRow, { borderBottomColor: colors.border }]}>
            <Pressable
              style={[styles.navSelectorBtn, { backgroundColor: colors.backgroundAlt }]}
              onPress={() => setMode(mode === 'monthPicker' ? 'calendar' : 'monthPicker')}>
              <Text style={[styles.navSelectorText, { color: colors.text }]}>
                {monthNames[currentMonth - 1]}
              </Text>
              <MaterialCommunityIcons
                name={mode === 'monthPicker' ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </Pressable>

            <Pressable
              style={[styles.navSelectorBtn, { backgroundColor: colors.backgroundAlt }]}
              onPress={() => setMode(mode === 'yearPicker' ? 'calendar' : 'yearPicker')}>
              <Text style={[styles.navSelectorText, { color: colors.text }]}>
                {currentYear} BS
              </Text>
              <MaterialCommunityIcons
                name={mode === 'yearPicker' ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </Pressable>

            <View style={styles.arrowGroup}>
              <Pressable style={styles.arrowBtn} hitSlop={8} onPress={handlePrevMonth}>
                <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
              </Pressable>
              <Pressable style={styles.arrowBtn} hitSlop={8} onPress={handleNextMonth}>
                <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Month Selector Grid */}
          {mode === 'monthPicker' ? (
            <View style={styles.pickerGrid}>
              {monthNames.map((name, idx) => {
                const isSelected = currentMonth === idx + 1;
                return (
                  <Pressable
                    key={name}
                    style={[
                      styles.monthTile,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.backgroundAlt,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      setCurrentMonth(idx + 1);
                      setMode('calendar');
                      void Haptics.selectionAsync();
                    }}>
                    <Text
                      style={[
                        styles.monthTileText,
                        { color: isSelected ? colors.onPrimary : colors.text },
                      ]}>
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Year Selector List */}
          {mode === 'yearPicker' ? (
            <ScrollView style={styles.yearScroll} contentContainerStyle={styles.yearGrid}>
              {yearsList.map((yr) => {
                const isSelected = currentYear === yr;
                return (
                  <Pressable
                    key={yr}
                    style={[
                      styles.yearTile,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.backgroundAlt,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      setCurrentYear(yr);
                      setMode('calendar');
                      void Haptics.selectionAsync();
                    }}>
                    <Text
                      style={[
                        styles.yearTileText,
                        { color: isSelected ? colors.onPrimary : colors.text },
                      ]}>
                      {yr}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* Calendar View */}
          {mode === 'calendar' ? (
            <View style={styles.calendarContainer}>
              {/* Day Headers (Sun - Sat) */}
              <View style={styles.daysHeaderRow}>
                {dayNames.map((day, idx) => (
                  <View key={day} style={styles.dayHeaderCell}>
                    <Text
                      style={[
                        styles.dayHeaderText,
                        { color: idx === 6 ? colors.danger : colors.textMuted },
                      ]}>
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Grid of Days */}
              <View style={styles.gridContainer}>
                {Array.from({ length: numRows * 7 }).map((_, index) => {
                  const dayNumber = index - monthInfo.firstDayOfWeek + 1;
                  const isValidDay = dayNumber >= 1 && dayNumber <= monthInfo.daysInMonth;
                  const isSelected = isValidDay && selectedDay === dayNumber;
                  const isToday =
                    isValidDay &&
                    currentYear === todayBs.year &&
                    currentMonth === todayBs.month &&
                    todayBs.day === dayNumber;
                  const isSaturday = index % 7 === 6;

                  if (!isValidDay) {
                    return <View key={`empty-${index}`} style={styles.dayCell} />;
                  }

                  return (
                    <Pressable
                      key={`day-${dayNumber}`}
                      style={[
                        styles.dayCell,
                        isToday && [styles.todayCell, { borderColor: colors.primary }],
                        isSelected && [styles.selectedCell, { backgroundColor: colors.primary }],
                      ]}
                      onPress={() => handleSelectDay(dayNumber)}>
                      <Text
                        style={[
                          styles.dayCellText,
                          { color: isSaturday ? colors.danger : colors.text },
                          isSelected && [styles.selectedDayText, { color: colors.onPrimary }],
                          isToday && !isSelected && [styles.todayText, { color: colors.primary }],
                        ]}>
                        {dayNumber}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.footerRow}>
            <Pressable
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={onClose}>
              <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>
                {isNepali ? 'रद्द गर्नुहोस्' : 'Cancel'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
              onPress={handleConfirm}>
              <Text style={[styles.confirmBtnText, { color: colors.onPrimary }]}>
                {isNepali ? 'मिति छान्नुहोस्' : 'Select Date'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.md,
    },
    modalCard: {
      width: '100%',
      maxWidth: 380,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    headerKicker: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      marginTop: 2,
    },
    closeBtn: {
      padding: 4,
    },
    presetRow: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    presetChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    presetChipText: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    navSelectorBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.md,
    },
    navSelectorText: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    arrowGroup: {
      flexDirection: 'row',
      marginLeft: 'auto',
      gap: 4,
    },
    arrowBtn: {
      padding: 4,
    },
    pickerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingVertical: spacing.sm,
    },
    monthTile: {
      width: '30%',
      flexGrow: 1,
      paddingVertical: 10,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    monthTileText: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    yearScroll: {
      maxHeight: 220,
      marginVertical: spacing.xs,
    },
    yearGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingVertical: spacing.xs,
    },
    yearTile: {
      width: '22%',
      flexGrow: 1,
      paddingVertical: 10,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    yearTileText: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    calendarContainer: {
      gap: spacing.xs,
    },
    daysHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 4,
    },
    dayHeaderCell: {
      width: '14.28%',
      alignItems: 'center',
    },
    dayHeaderText: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: '14.28%',
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    todayCell: {
      borderWidth: 1.5,
    },
    selectedCell: {
      borderRadius: radius.pill,
    },
    dayCellText: {
      fontSize: typography.body,
      fontWeight: '600',
    },
    selectedDayText: {
      fontWeight: '800',
    },
    todayText: {
      fontWeight: '800',
    },
    footerRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    cancelBtn: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnText: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    confirmBtn: {
      flex: 1.5,
      minHeight: 44,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmBtnText: {
      fontSize: typography.body,
      fontWeight: '800',
    },
  });
