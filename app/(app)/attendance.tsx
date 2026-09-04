import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { staffApi, metaApi } from '@/src/api';
import { Screen } from '@/src/shared/layout/Screen';
import { PageHeading } from '@/src/shared/ui/PageHeading';
import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import { useAuthStore } from '@/src/stores/auth-store';
import { useTranslation } from '@/src/i18n';
import { spacing, radius, typography, shadows } from '@/src/theme';
import type { Attendance, StaffMember } from '@/src/types/models';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

export default function AttendanceScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { businessUserId: searchUserId } = useLocalSearchParams<{ businessUserId?: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const businessSettings = useAuthStore((state) => state.businessSettings);

  const userRole = session?.role ?? user?.role ?? 'staff';
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

  // Filter state for history log
  const [selectedUserId, setSelectedUserId] = useState<string>(searchUserId || '');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  
  // Fetch today's status
  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: async () => {
      const res = await staffApi.getTodayAttendance();
      return res as unknown as { attendance: Attendance | null };
    },
  });

  // Fetch history logs
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['attendance-history', selectedUserId],
    queryFn: async () => {
      const queryParams: any = {};
      if (selectedUserId) {
        queryParams.businessUserId = selectedUserId;
      }
      const res = await staffApi.getAttendanceHistory(queryParams);
      return res as unknown as { history: Attendance[] };
    },
  });

  // Fetch staff list for owners to filter
  const { data: staffList } = useQuery({
    queryKey: ['staff-list-attendance'],
    queryFn: async () => {
      const res = await staffApi.list({ limit: 100 });
      return res?.members || [];
    },
    enabled: isOwnerOrAdmin,
  });

  // Get current device location
  const getDeviceLocation = async () => {
    setGpsLoading(true);
    setGpsError(null);
    setErrorMessage(null);
    setActionSuccessMessage(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsError('GPS location access denied. Please enable location services in device settings.');
        setGpsLoading(false);
        return null;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setGpsCoords(coords);
      setGpsLoading(false);
      return coords;
    } catch (err) {
      setGpsError('Unable to retrieve GPS location. Ensure location is enabled on this device.');
      setGpsLoading(false);
      return null;
    }
  };

  // Mutations
  const punchInMutation = useMutation({
    mutationFn: (coords: { latitude: number; longitude: number }) => staffApi.punchIn(coords),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      setActionSuccessMessage(res.message || t('staff.checkIn'));
      Alert.alert(t('common.success'), res.message || t('staff.checkIn'));
    },
    onError: (error: any) => {
      setErrorMessage(error?.message || t('common.error'));
    },
  });

  const punchOutMutation = useMutation({
    mutationFn: (coords: { latitude: number; longitude: number }) => staffApi.punchOut(coords),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      setActionSuccessMessage(res.message || t('staff.checkOut'));
      Alert.alert(t('common.success'), res.message || t('staff.checkOut'));
    },
    onError: (error: any) => {
      setErrorMessage(error?.message || t('common.error'));
    },
  });

  const handlePunchIn = async () => {
    const coords = await getDeviceLocation();
    if (!coords) return;
    punchInMutation.mutate(coords);
  };

  const handlePunchOut = async () => {
    const coords = await getDeviceLocation();
    if (!coords) return;
    punchOutMutation.mutate(coords);
  };

  // Automatically load GPS coordinates on load
  useEffect(() => {
    getDeviceLocation();
  }, []);

  const today = todayData?.attendance;
  const officeConfigured = businessSettings?.officeLatitude !== null && businessSettings?.officeLongitude !== null;

  return (
    <Screen scrollable={false} topBarTitle={t('staff.attendance')}>
      <PageHeading subtitle="Check-in or out of your work shift using geolocation validation." />

      {todayLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          {/* Main Action Panel */}
          <SurfaceCard style={styles.mainCard}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusLabel}>{t('staff.attendance')}</Text>
              {!today ? (
                <View style={[styles.badge, styles.badgeInactive]}>
                  <Text style={styles.badgeTextInactive}>{t('staff.absent')}</Text>
                </View>
              ) : today.punchOutTime ? (
                <View style={[styles.badge, styles.badgeCompleted]}>
                  <Text style={styles.badgeTextCompleted}>{t('tasks.completed')}</Text>
                </View>
              ) : (
                <View style={[styles.badge, styles.badgeActive]}>
                  <Text style={styles.badgeTextActive}>{t('staff.present')}</Text>
                </View>
              )}
            </View>

            {/* Geolocation Radius indicator */}
            {officeConfigured ? (
              <View style={styles.officeIndicator}>
                <MaterialCommunityIcons name="office-building" size={20} color={colors.primary} />
                <Text style={styles.officeText}>
                  {t('staff.geofenceActive')} ({(businessSettings?.officeRadiusMeters) || 100}m)
                </Text>
              </View>
            ) : (
              <View style={[styles.officeIndicator, styles.officeIndicatorWarning]}>
                <MaterialCommunityIcons name="office-building-marker" size={20} color={colors.warning} />
                <Text style={[styles.officeText, { color: colors.textMuted }]}>
                  {t('staff.geofenceDisabled')}
                </Text>
              </View>
            )}

            {/* Alerts / Success Banners */}
            {gpsError ? (
              <View style={styles.alertBannerError}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.danger} />
                <Text style={styles.alertText}>{gpsError}</Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.alertBannerError}>
                <MaterialCommunityIcons name="close-circle-outline" size={20} color={colors.danger} />
                <Text style={styles.alertText}>{errorMessage}</Text>
              </View>
            ) : null}

            {actionSuccessMessage ? (
              <View style={styles.alertBannerSuccess}>
                <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={20} color={colors.success} />
                <Text style={styles.alertSuccessText}>{actionSuccessMessage}</Text>
              </View>
            ) : null}

            {/* Big Action Check-In/Out Button */}
            <View style={styles.actionBtnContainer}>
              {gpsLoading || punchInMutation.isPending || punchOutMutation.isPending ? (
                <View style={styles.bigCircleLoading}>
                  <ActivityIndicator color={colors.primary} size="large" />
                </View>
              ) : !today ? (
                <Pressable style={styles.bigCircleCheckIn} onPress={handlePunchIn}>
                  <MaterialCommunityIcons name="fingerprint" size={54} color={colors.white} />
                  <Text style={styles.bigCircleText}>{t('staff.checkIn').toUpperCase()}</Text>
                </Pressable>
              ) : today.punchOutTime ? (
                <View style={styles.bigCircleCompleted}>
                  <MaterialCommunityIcons name="check-all" size={54} color={colors.success} />
                  <Text style={[styles.bigCircleText, { color: colors.success }]}>{t('tasks.completed').toUpperCase()}</Text>
                </View>
              ) : (
                <Pressable style={styles.bigCircleCheckOut} onPress={handlePunchOut}>
                  <MaterialCommunityIcons name="logout" size={54} color={colors.white} />
                  <Text style={styles.bigCircleText}>{t('staff.checkOut').toUpperCase()}</Text>
                </Pressable>
              )}
            </View>

            {/* Timestamps */}
            {today ? (
              <View style={styles.timeline}>
                <View style={styles.timelineRow}>
                  <Text style={styles.timeLabel}>{t('staff.checkIn')}:</Text>
                  <Text style={styles.timeVal}>
                    {new Date(today.punchInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {today.punchOutTime ? (
                  <View style={styles.timelineRow}>
                    <Text style={styles.timeLabel}>{t('staff.checkOut')}:</Text>
                    <Text style={styles.timeVal}>
                      {new Date(today.punchOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={styles.hintText}>{t('staff.verifiedLocation')}</Text>
            )}
          </SurfaceCard>

          {/* History filter for Admin/Owner */}
          {isOwnerOrAdmin && staffList ? (
            <View style={styles.filterSection}>
              <Text style={styles.sectionHeader}>Filter History logs</Text>
              <View style={styles.presetGrid}>
                <Pressable
                  style={[styles.presetChip, !selectedUserId && styles.presetChipSelected]}
                  onPress={() => setSelectedUserId('')}>
                  <Text style={[styles.presetChipText, !selectedUserId && styles.presetChipTextSelected]}>
                    All Members
                  </Text>
                </Pressable>
                {staffList.map((m: StaffMember) => {
                  const id = m.id;
                  const selected = selectedUserId === id;
                  return (
                    <Pressable
                      key={id}
                      style={[styles.presetChip, selected && styles.presetChipSelected]}
                      onPress={() => setSelectedUserId(id)}>
                      <Text style={[styles.presetChipText, selected && styles.presetChipTextSelected]}>
                        {m.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* History Section */}
          <Text style={styles.sectionHeader}>Attendance logs history</Text>

          {historyLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : (
            <View style={styles.historyList}>
              {(historyData?.history || []).map((record) => {
                const checkedOut = record.punchOutTime;
                const inTime = new Date(record.punchInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const outTime = checkedOut
                  ? new Date(checkedOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Active';

                const nameStr = record.BusinessUser?.name || 'Staff Member';

                return (
                  <View key={record.id} style={styles.historyCard}>
                    <View style={styles.histHeader}>
                      <View>
                        <Text style={styles.histDate}>{record.date}</Text>
                        {isOwnerOrAdmin ? (
                          <Text style={styles.histUser}>{nameStr}</Text>
                        ) : null}
                      </View>
                      <View style={[styles.histStatus, checkedOut ? styles.histStatusGreen : styles.histStatusOrange]}>
                        <Text style={checkedOut ? styles.histStatusTextGreen : styles.histStatusTextOrange}>
                          {checkedOut ? 'Completed' : 'On Duty'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.histTimesRow}>
                      <View style={styles.histTimeTile}>
                        <MaterialCommunityIcons name="clock-in" size={16} color={colors.success} />
                        <Text style={styles.histTimeText}>In: {inTime}</Text>
                      </View>
                      <View style={styles.histTimeTile}>
                        <MaterialCommunityIcons name="clock-out" size={16} color={checkedOut ? colors.danger : colors.textSoft} />
                        <Text style={styles.histTimeText}>Out: {outTime}</Text>
                      </View>
                    </View>

                    {record.punchInLatitude ? (
                      <Text style={styles.coordsText}>
                        GPS: {record.punchInLatitude.toFixed(5)}, {record.punchInLongitude?.toFixed(5)}
                      </Text>
                    ) : null}
                  </View>
                );
              })}

              {!historyData?.history?.length ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={colors.textSoft} />
                  <Text style={styles.emptyText}>No attendance history records found.</Text>
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const createStyles = (colors: AppPalette) => StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: typography.body,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  mainCard: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  statusLabel: {
    fontSize: typography.body,
    fontWeight: '800',
    color: colors.text,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeInactive: {
    backgroundColor: colors.border,
  },
  badgeTextInactive: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
  },
  badgeActive: {
    backgroundColor: colors.successSoft,
  },
  badgeTextActive: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.success,
  },
  badgeCompleted: {
    backgroundColor: colors.infoSoft,
  },
  badgeTextCompleted: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.info,
  },
  officeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentMuted,
    borderWidth: 1,
    borderRadius: radius.md,
    width: '100%',
  },
  officeIndicatorWarning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBright,
  },
  officeText: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.primary,
    flex: 1,
  },
  alertBannerError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    width: '100%',
  },
  alertText: {
    color: colors.danger,
    fontSize: typography.caption,
    fontWeight: '700',
    flex: 1,
    lineHeight: 18,
  },
  alertBannerSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    width: '100%',
  },
  alertSuccessText: {
    color: colors.success,
    fontSize: typography.caption,
    fontWeight: '700',
    flex: 1,
  },
  actionBtnContainer: {
    height: 180,
    width: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  bigCircleCheckIn: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floating,
    gap: spacing.xs,
    borderWidth: 6,
    borderColor: colors.accentMuted,
  },
  bigCircleCheckOut: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floating,
    gap: spacing.xs,
    borderWidth: 6,
    borderColor: colors.dangerSoft,
  },
  bigCircleCompleted: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: colors.successSoft,
    gap: spacing.xxs,
  },
  bigCircleLoading: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: colors.border,
  },
  bigCircleText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 1,
  },
  timeline: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeLabel: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
  timeVal: {
    fontSize: typography.body,
    fontWeight: '800',
    color: colors.text,
  },
  hintText: {
    fontSize: typography.caption,
    color: colors.textSoft,
    textAlign: 'center',
  },
  filterSection: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  sectionHeader: {
    fontSize: typography.label,
    fontWeight: '800',
    color: colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  presetChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetChipText: {
    fontSize: typography.label,
    fontWeight: '600',
    color: colors.textMuted,
  },
  presetChipTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  historyList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  historyCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  histHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  histDate: {
    fontSize: typography.body,
    fontWeight: '800',
    color: colors.text,
  },
  histUser: {
    fontSize: typography.caption,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  histStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  histStatusGreen: {
    backgroundColor: colors.successSoft,
  },
  histStatusOrange: {
    backgroundColor: colors.dangerSoft,
  },
  histStatusTextGreen: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.success,
  },
  histStatusTextOrange: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.danger,
  },
  histTimesRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundWarm,
    paddingTop: spacing.xs,
  },
  histTimeTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  histTimeText: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.text,
  },
  coordsText: {
    fontSize: 9,
    color: colors.textSoft,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: 'center',
  },
});
