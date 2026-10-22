import { Tooltip } from "../../components/ui/Tooltip";
import { MarkedText } from "../../components/ui/MarkedText";
import { AMP_POWER_TIP } from "../../constants/ampPower";
import type { SpeakerBand } from "../../types";
import { Button } from "../../components/ui/Button";
import { FoldBox } from "../../components/ui/FoldBox";
import { BandDot } from "../../components/ui/BandDot";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField } from "../../components/ui/SelectField";
import { TextField } from "../../components/ui/TextField";
import { byId } from "../../lib/tables";
import { entriesOf, keysOf } from "../../lib/records";
import { SPEAKER_TEXT, DRIVE_NAMES } from "../../constants/speakerPage";
import { SETTINGS_TEXT } from "../../constants/speakerSettings";
import { FilterFields } from "./FilterFields";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import { SPEAKER_STEPS } from "../../constants/speakerSteps";
import { TRIO_ROW } from "../../styles/layout";
import { bandSummary } from "./settingsSummaries";
import { PAD_MAX_DB, isPassive, withPadCapped } from "../../lib/speaker/bandLevel";
import { WithLock } from "../../components/ui/LockButton";
import type { SpeakerLocks } from "./useSpeakerOptimizer";

/** The crossover choices, as the band's picker lists them. */
const DRIVE_OPTIONS = entriesOf(DRIVE_NAMES).map(([id, name]) => ({ id, name }));

interface Props {
  band: SpeakerBand;
  /** its place among the bands, low to high, and how many there are: its dot's color */
  index: number;
  count: number;
  /** a new filter's corner, Hz */
  newCornerHz: number;
  onEdit: (edit: (band: SpeakerBand) => SpeakerBand) => void;
  /** absent for the last band left */
  onRemove?: () => void;
  /** the optimizer's locks beside its filters and its amp power */
  locks: SpeakerLocks;
}

/**
 * One band, in a box that folds to its summary with its dot ("High · High-pass LR24 1200 Hz · Low-pass off · 100 W"):
 * its name, high-pass and low-pass, level, crossover and amp power.
 */
export function BandSettings({ band, index, count, newCornerHz, onEdit, onRemove, locks }: Props) {
  return (
    <FoldBox
      summary={bandSummary(band)}
      lead={<BandDot index={index} count={count} />}
      actions={
        onRemove && (
          <Button size="xs" variant="danger" onClick={onRemove}>
            {SETTINGS_TEXT.removeBand}
          </Button>
        )
      }
    >
      <TextField
        label="Name"
        value={band.name}
        maxLength={30}
        onChange={(name) => onEdit((b) => ({ ...b, name }))}
      />
      <FilterFields
        filters={band}
        newCornerHz={newCornerHz}
        onEdit={(edit) => onEdit((b) => ({ ...b, ...edit(b) }))}
        locks={{
          highpass: locks.partLock("highpass", band.id),
          lowpass: locks.partLock("lowpass", band.id),
        }}
      />
      <div className={TRIO_ROW}>
        {isPassive(band) ? (
          <NumberField
            label={
              <Tooltip tip={<MarkedText text={SPEAKER_TEXT.padTip} />}>{SPEAKER_TEXT.pad}</Tooltip>
            }
            // shown to 0.1 dB (the Hi-fi level match is exact)
            value={Math.round(band.levelDb * 10) / 10}
            max={PAD_MAX_DB}
            step={SPEAKER_STEPS.levelDb}
            unit="dB"
            fill
            onChange={(levelDb) =>
              onEdit((b) => ({ ...b, levelDb: Math.min(PAD_MAX_DB, levelDb) }))
            }
          />
        ) : (
          <NumberField
            label={<Tooltip tip={SPEAKER_TEXT.levelTip}>{SPEAKER_TEXT.gain}</Tooltip>}
            // shown to 0.1 dB (the Hi-fi level match is exact)
            value={Math.round(band.levelDb * 10) / 10}
            step={SPEAKER_STEPS.levelDb}
            unit="dB"
            fill
            onChange={(levelDb) => onEdit((b) => ({ ...b, levelDb }))}
          />
        )}
        <SelectField
          label={<Tooltip tip={SPEAKER_TEXT.driveTip}>Crossover</Tooltip>}
          options={DRIVE_OPTIONS}
          value={byId(DRIVE_OPTIONS, band.drive)}
          onChange={(o) => {
            // the picker lists exactly the drives (DRIVE_OPTIONS)
            const drive = keysOf(DRIVE_NAMES).find((k) => k === o.id);
            // a band made passive keeps its level only as a Pad: never above 0 dB
            if (drive) onEdit((b) => withPadCapped({ ...b, drive }));
          }}
        />
        <WithLock lock={locks.partLock("amps", band.id)}>
          <NumberField
            // passive: the channel it shares
            label={
              <Tooltip tip={AMP_POWER_TIP}>
                {band.drive === HIFI_DRIVE.passive
                  ? SPEAKER_TEXT.sharedAmp
                  : SETTINGS_TEXT.ampPower}
              </Tooltip>
            }
            value={band.ampW}
            min={1}
            step={SPEAKER_STEPS.ampW}
            unit="W"
            fill
            onChange={(ampW) => onEdit((b) => ({ ...b, ampW }))}
          />
        </WithLock>
      </div>
    </FoldBox>
  );
}
