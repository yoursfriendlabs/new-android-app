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
import { Screen } from '@/src/components/layout/Screen';
import { PageHeading } from '@/src/components/ui/PageHeading';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { useAuthStore } from '@/src/stores/auth-store';
import { palette, spacing, radius, typography, shadows } from '@/src/theme';
import type { Attendance, StaffMember } from '@/src/types/models';

export default function AttendanceScreen() {
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
      setActionSuccessMessage(res.message || 'Punch-in successful');
      Alert.alert('Success', res.message || 'Check-in registered.');
    },
    onError: (error: any) => {
      setErrorMessage(error?.message || 'Check-in failed');
    },
  });

  const punchOutMutation = useMutation({
    mutationFn: (coords: { latitude: number; longitude: number }) => staffApi.punchOut(coords),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      setActionSuccessMessage(res.message || 'Punch-out successful');
      Alert.alert('Success', res.message || 'Check-out registered.');
    },
    onError: (error: any) => {
      setErrorMessage(error?.message || 'Check-out failed');
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
    <Screen topBarTitle="Attendance Check">
      <PageHeading title="Work Shift Attendance" subtitle="Check-in or out of your work shift using geolocation validation." />

      {todayLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.primary} size="large" />
          <Text style={styles.loadingText}>Fetching shift status...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Main Action Panel */}
          <SurfaceCard style={styles.mainCard}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusLabel}>Today's Shift Status</Text>
              {!today ? (
                <View style={[styles.badge, styles.badgeInactive]}>
                  <Text style={styles.badgeTextInactive}>Not Checked In</Text>
                </View>
              ) : today.punchOutTime ? (
                <View style={[styles.badge, styles.badgeCompleted]}>
                  <Text style={styles.badgeTextCompleted}>Shift Completed</Text>
                </View>
              ) : (
                <View style={[styles.badge, styles.badgeActive]}>
                  <Text style={styles.badgeTextActive}>On Duty</Text>
                </View>
              )}
            </View>

            {/* Geolocation Radius indicator */}
            {officeConfigured ? (
              <View style={styles.officeIndicator}>
                <MaterialCommunityIcons name="office-building" size={20} color={palette.primary} />
                <Text style={styles.officeText}>
                  Office Radius Check Enabled ({(businessSettings?.officeRadiusMeters) || 100}m radius)
                </Text>
              </View>
            ) : (
              <View style={[styles.officeIndicator, styles.officeIndicatorWarning]}>
                <MaterialCommunityIcons name="office-building-marker" size={20} color={palette.warning} />
                <Text style={[styles.officeText, { color: palette.textMuted }]}>
                  Office Location NOT configured. Check-ins allowed from anywhere.
                </Text>
              </View>
            )}

            {/* Alerts / Success Banners */}
            {gpsError ? (
              <View style={styles.alertBannerError}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={palette.danger} />
                <Text style={styles.alertText}>{gpsError}</Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.alertBannerError}>
                <MaterialCommunityIcons name="close-circle-outline" size={20} color={palette.danger} />
                <Text style={styles.alertText}>{errorMessage}</Text>
              </View>
            ) : null}

            {actionSuccessMessage ? (
              <View style={styles.alertBannerSuccess}>
                <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={20} color={palette.success} />
                <Text style={styles.alertSuccessText}>{actionSuccessMessage}</Text>
              </View>
            ) : null}

            {/* Big Action Check-In/Out Button */}
            <View style={styles.actionBtnContainer}>
              {gpsLoading || punchInMutation.isPending || punchOutMutation.isPending ? (
                <View style={styles.bigCircleLoading}>
                  <ActivityIndicator color={palette.primary} size="large" />
                </View>
              ) : !today ? (
                <Pressable style={styles.bigCircleCheckIn} onPress={handlePunchIn}>
                  <MaterialCommunityIcons name="fingerprint" size={54} color={palette.white} />
                  <Text style={styles.bigCircleText}>CHECK IN</Text>
                </Pressable>
              ) : today.punchOutTime ? (
                <View style={styles.bigCircleCompleted}>
                  <MaterialCommunityIcons name="check-all" size={54} color={palette.success} />
                  <Text style={[styles.bigCircleText, { color: palette.success }]}>COMPLETED</Text>
                </View>
              ) : (
                <Pressable style={styles.bigCircleCheckOut} onPress={handlePunchOut}>
                  <MaterialCommunityIcons name="logout" size={54} color={palette.white} />
                  <Text style={styles.bigCircleText}>CHECK OUT</Text>
                </Pressable>
              )}
            </View>

            {/* Timestamps */}
            {today ? (
              <View style={styles.timeline}>
                <View style={styles.timelineRow}>
                  <Text style={styles.timeLabel}>Check-in Time:</Text>
                  <Text style={styles.timeVal}>
                    {new Date(today.punchInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {today.punchOutTime ? (
                  <View style={styles.timelineRow}>
                    <Text style={styles.timeLabel}>Check-out Time:</Text>
                    <Text style={styles.timeVal}>
                      {new Date(today.punchOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={styles.hintText}>Tapping Check In will register your location & time.</Text>
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
            <ActivityIndicator color={palette.primary} style={{ marginVertical: spacing.md }} />
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
                        <MaterialCommunityIcons name="clock-in" size={16} color={palette.success} />
                        <Text style={styles.histTimeText}>In: {inTime}</Text>
                      </View>
                      <View style={styles.histTimeTile}>
                        <MaterialCommunityIcons name="clock-out" size={16} color={checkedOut ? palette.danger : palette.textSoft} />
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
                  <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={palette.textSoft} />
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

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    color: palette.textMuted,
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
    color: palette.text,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeInactive: {
    backgroundColor: palette.border,
  },
  badgeTextInactive: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.textMuted,
  },
  badgeActive: {
    backgroundColor: palette.successSoft,
  },
  badgeTextActive: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.success,
  },
  badgeCompleted: {
    backgroundColor: palette.infoSoft,
  },
  badgeTextCompleted: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.info,
  },
  officeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: palette.accentSoft,
    borderColor: palette.accentMuted,
    borderWidth: 1,
    borderRadius: radius.md,
    width: '100%',
  },
  officeIndicatorWarning: {
    backgroundColor: palette.warningSoft,
    borderColor: palette.warningBright,
  },
  officeText: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: palette.primary,
    flex: 1,
  },
  alertBannerError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: palette.dangerSoft,
    borderRadius: radius.md,
    width: '100%',
  },
  alertText: {
    color: palette.danger,
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
    backgroundColor: palette.successSoft,
    borderRadius: radius.md,
    width: '100%',
  },
  alertSuccessText: {
    color: palette.success,
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
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floating,
    gap: spacing.xs,
    borderWidth: 6,
    borderColor: palette.accentMuted,
  },
  bigCircleCheckOut: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: palette.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floating,
    gap: spacing.xs,
    borderWidth: 6,
    borderColor: palette.dangerSoft,
  },
  bigCircleCompleted: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: palette.successSoft,
    gap: spacing.xxs,
  },
  bigCircleLoading: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: palette.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: palette.border,
  },
  bigCircleText: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.white,
    letterSpacing: 1,
  },
  timeline: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeLabel: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  timeVal: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  hintText: {
    fontSize: typography.caption,
    color: palette.textSoft,
    textAlign: 'center',
  },
  filterSection: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  sectionHeader: {
    fontSize: typography.label,
    fontWeight: '800',
    color: palette.textSoft,
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
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  presetChipSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  presetChipText: {
    fontSize: typography.label,
    fontWeight: '600',
    color: palette.textMuted,
  },
  presetChipTextSelected: {
    color: palette.white,
    fontWeight: '700',
  },
  historyList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  historyCard: {
    backgroundColor: palette.surface,
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
    color: palette.text,
  },
  histUser: {
    fontSize: typography.caption,
    color: palette.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  histStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  histStatusGreen: {
    backgroundColor: palette.successSoft,
  },
  histStatusOrange: {
    backgroundColor: palette.dangerSoft,
  },
  histStatusTextGreen: {
    fontSize: 9,
    fontWeight: '800',
    color: palette.success,
  },
  histStatusTextOrange: {
    fontSize: 9,
    fontWeight: '800',
    color: palette.danger,
  },
  histTimesRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: palette.backgroundWarm,
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
    color: palette.text,
  },
  coordsText: {
    fontSize: 9,
    color: palette.textSoft,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: typography.body,
    textAlign: 'center',
  },
});
