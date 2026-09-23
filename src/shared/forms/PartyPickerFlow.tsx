import { useState } from 'react';

import { PartyPickerSheet } from '@/src/shared/forms/PartyPickerSheet';
import { DeviceContactSheet } from '@/src/features/parties/components/DeviceContactSheet';
import { PartyFormSheet } from '@/src/features/parties/components/PartyFormSheet';
import type { DeviceContactDraft } from '@/src/features/parties/lib/device-contacts';
import type { Party } from '@/src/types/models';

interface PartyPickerFlowProps {
  visible: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  parties: Party[];
  onPick: (party: Party | null) => void;
  onClose: () => void;
  allowWalkIn?: boolean;
  walkInLabel?: string;
  walkInSubtitle?: string;
  title?: string;
  subtitle?: string;
  createLabel?: string;
  phoneImportLabel?: string;
  typeLabel?: (party: Party) => string;
}

/**
 * Everywhere a party is chosen, all three ways in are offered: pick one already
 * saved, type a new one, or lift someone out of the phone's contacts. Only one
 * sheet is on screen at a time — Android shows a single modal reliably.
 */
export function PartyPickerFlow({
  allowWalkIn,
  createLabel,
  onClose,
  onPick,
  onSearchChange,
  parties,
  phoneImportLabel,
  search,
  subtitle,
  title,
  typeLabel,
  visible,
  walkInLabel,
  walkInSubtitle,
}: PartyPickerFlowProps) {
  const [stage, setStage] = useState<'pick' | 'phone' | 'form'>('pick');
  const [seed, setSeed] = useState<DeviceContactDraft | null>(null);

  const reset = () => {
    setStage('pick');
    setSeed(null);
  };

  const finish = (party: Party) => {
    reset();
    onPick(party);
  };

  return (
    <>
      <PartyPickerSheet
        visible={visible && stage === 'pick'}
        search={search}
        onSearchChange={onSearchChange}
        parties={parties}
        onPick={onPick}
        onClose={() => {
          reset();
          onClose();
        }}
        allowWalkIn={allowWalkIn}
        walkInLabel={walkInLabel}
        walkInSubtitle={walkInSubtitle}
        title={title}
        subtitle={subtitle}
        createLabel={createLabel}
        phoneImportLabel={phoneImportLabel}
        typeLabel={typeLabel}
        onCreatePress={() => {
          // Carry whatever they already typed into the name field.
          setSeed(search.trim() ? { name: search.trim() } : null);
          setStage('form');
        }}
        onPhoneImportPress={() => setStage('phone')}
      />

      <DeviceContactSheet
        visible={visible && stage === 'phone'}
        // The contact sheet closes itself after a pick, so only step back when
        // nothing was chosen — otherwise it would undo the jump to the form.
        onClose={() => setStage((current) => (current === 'phone' ? 'pick' : current))}
        onPick={(contact) => {
          setSeed(contact);
          setStage('form');
        }}
      />

      <PartyFormSheet
        visible={visible && stage === 'form'}
        seed={seed}
        onClose={() => setStage('pick')}
        onSaved={finish}
      />
    </>
  );
}
