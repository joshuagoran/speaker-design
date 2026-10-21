import { Tooltip } from "../../components/ui/Tooltip";
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
}

/**
 * One band, in a box that folds to its summary with its dot ("High · High-pass LR24 1200 Hz · Low-pass off · 100 W"):
 * its name, high-pass and low-pass, level, crossover and amp power.
 */
export function BandSettings({ band, index, count, newCornerHz, onEdit, onRemove }: Props) {
  return (
    <FoldBox
      summary={bandSummary(band)}
      lead={<BandDot index={index} count={count} />}
      actions={
        onRemove && (
          <Button size="xs" onClick={onRemove}>
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
      />
      <div className={TRIO_ROW}>
        <NumberField
          label={<Tooltip tip={SPEAKER_TEXT.levelTip}>Gain</Tooltip>}
          // shown to 0.1 dB (the Hi-fi level match is exact)
          value={Math.round(band.levelDb * 10) / 10}
          step={SPEAKER_STEPS.levelDb}
          unit="dB"
          fill
          onChange={(levelDb) => onEdit((b) => ({ ...b, levelDb }))}
        />
        <SelectField
          label={<Tooltip tip={SPEAKER_TEXT.driveTip}>Crossover</Tooltip>}
          options={DRIVE_OPTIONS}
          value={byId(DRIVE_OPTIONS, band.drive)}
          onChange={(o) => {
            // the picker lists exactly the drives (DRIVE_OPTIONS)
            const drive = keysOf(DRIVE_NAMES).find((k) => k === o.id);
            if (drive) onEdit((b) => ({ ...b, drive }));
          }}
        />
        <NumberField
          // passive: the channel it shares
          label={
            <Tooltip tip={AMP_POWER_TIP}>
              {band.drive === HIFI_DRIVE.passive ? SPEAKER_TEXT.sharedAmp : SETTINGS_TEXT.ampPower}
            </Tooltip>
          }
          value={band.ampW}
          min={1}
          step={SPEAKER_STEPS.ampW}
          unit="W"
          fill
          onChange={(ampW) => onEdit((b) => ({ ...b, ampW }))}
        />
      </div>
    </FoldBox>
  );
}
