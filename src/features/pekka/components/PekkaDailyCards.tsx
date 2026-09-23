import { DAY_CLOSE_TIMES } from '../lib/day-close';
import { MORNING_TIMES } from '../lib/morning';
import { usePekkaStore } from '../stores/pekka-store';
import { PekkaScheduleCard } from './PekkaScheduleCard';

/** Pekka's two daily moments: the morning summary and the evening day-close. */
export function PekkaDailyCards() {
  const morning = usePekkaStore((state) => state.morning);
  const setMorning = usePekkaStore((state) => state.setMorning);
  const dayClose = usePekkaStore((state) => state.dayClose);
  const setDayClose = usePekkaStore((state) => state.setDayClose);

  return (
    <>
      <PekkaScheduleCard
        icon="weather-sunset-up"
        titleKey="pekka.morning.cardTitle"
        onKey="pekka.morning.cardOn"
        offKey="pekka.morning.cardOff"
        times={MORNING_TIMES}
        settings={morning}
        onChange={setMorning}
      />
      <PekkaScheduleCard
        icon="weather-night"
        titleKey="pekka.close.cardTitle"
        onKey="pekka.close.cardOn"
        offKey="pekka.close.cardOff"
        times={DAY_CLOSE_TIMES}
        settings={dayClose}
        onChange={setDayClose}
      />
    </>
  );
}
