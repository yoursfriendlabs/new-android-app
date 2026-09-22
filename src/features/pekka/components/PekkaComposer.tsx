import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { useTranslation } from '@/src/i18n';
import { useLanguageStore } from '@/src/stores/language-store';
import { spacing, radius } from '@/src/theme';
import { usePekkaVoice, voiceInputAvailable } from '../hooks/usePekkaVoice';

export function PekkaComposer({ value, onChange, onSend, onVoiceInput, open, busy }: {
  value: string; onChange: (value: string) => void; onSend: () => void;
  /** Called when the text came from the microphone, so Pekka can answer out loud. */
  onVoiceInput?: () => void;
  open: boolean; busy: boolean;
}) {
  const colors = usePalette();
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const voice = usePekkaVoice(open && !busy, (text) => { onChange(text); onVoiceInput?.(); }, language === 'ne' ? 'ne-NP' : 'en-US');
  // Expo Go and older builds have no speech module: offer typing only.
  const canSpeak = voiceInputAvailable();
  return <View style={styles.wrap}>
    <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}>
      <TextInput
        accessibilityLabel={t('pekka.askPlaceholder')}
        placeholder={t('pekka.askPlaceholder')}
        placeholderTextColor={colors.textMuted}
        value={value} onChangeText={onChange} maxLength={300}
        style={[styles.input, { color: colors.text }]} editable={!busy}
        returnKeyType="send" onSubmitEditing={() => { if (value.trim() && !busy && !voice.listening && !voice.starting) onSend(); }}
      />
      {canSpeak ? <Pressable accessibilityRole="button" accessibilityLabel={t(voice.listening ? 'pekka.stopVoice' : 'pekka.startVoice')}
        onPress={() => void voice.toggle()} disabled={busy || voice.starting} style={styles.button}>
        {voice.starting ? <ActivityIndicator color={colors.primary} /> : <MaterialCommunityIcons name={voice.listening ? 'stop-circle' : 'microphone'} size={24} color={voice.listening ? colors.danger : colors.primary} />}
      </Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={t('pekka.send')} onPress={onSend}
        disabled={busy || !value.trim() || voice.listening || voice.starting} style={[styles.button, { opacity: busy || !value.trim() || voice.listening || voice.starting ? 0.4 : 1 }]}>
        <MaterialCommunityIcons name="send" size={22} color={colors.primary} />
      </Pressable>
    </View>
    {canSpeak ? <Text variant="caption" tone={voice.error ? 'danger' : 'muted'}>
      {voice.error ? t(voice.error === 'permission' ? 'pekka.voicePermission' : 'pekka.voiceUnavailable') : t(voice.listening ? 'pekka.listening' : 'pekka.voiceHint')}
    </Text> : null}
    {voice.alternatives.map((text) => <Pressable key={text} onPress={() => onChange(text)}>
      <Text variant="caption" color={colors.primary}>{text}</Text>
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  wrap: { gap: spacing.xxs, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md },
  input: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: spacing.sm, fontSize: 15 },
  button: { minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
