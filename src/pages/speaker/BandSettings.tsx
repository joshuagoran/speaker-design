import { Tooltip } from "../../components/ui/Tooltip";
import { AMP_POWER_LABEL, AMP_POWER_TIP } from "../../constants/ampPower";
import type { SpeakerBand } from "../../types";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { CardHeading } from "../../components/ui/CardHeading";
import { NumberField } from "../../components/ui/NumberField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { TextField } from "../../components/ui/TextField";
import { entriesOf } from "../../lib/records";
import { SPEAKER_TEXT, DRIVE_NAMES } from "../../constants/speakerPage";
import { FilterFields } from "./FilterFields";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import { SPEAKER_STEPS } from "../../constants/speakerSteps";

interface Props {
  band: SpeakerBand;
  /** a new filter's corner, Hz */
  newCornerHz: number;
  onEdit: (edit: (band: SpeakerBand) => SpeakerBand) => void;
  /** absent for the last band left */
  onRemove?: () => void;
}

/** One band's settings: its name, highpass and lowpass, level, drive and amp power. */
export function BandSettings({ band, newCornerHz, onEdit, onRemove }: Props) {
  return (
    <Card>
      <CardHeading
        action={
          onRemove && (
            <Button size="xs" onClick={onRemove}>
              Remove band
            </Button>
          )
        }
      >
        {band.name}
      </CardHeading>
      <TextField
        label="Name"
        value={band.name}
        maxLength={30}
        onChange={(name) => onEdit((b) => ({ ...b, name }))}
      />
      <FilterFields
        filters={band}
        newCornerHz={newCornerHz}
        offName={SPEAKER_TEXT.noFilter}
        onEdit={(edit) => onEdit((b) => ({ ...b, ...edit(b) }))}
      />
      <NumberField
        label={<Tooltip tip={SPEAKER_TEXT.levelTip}>Level</Tooltip>}
        // shown to 0.1 dB (the Hi-fi level match is exact)
        value={Math.round(band.levelDb * 10) / 10}
        step={SPEAKER_STEPS.levelDb}
        unit="dB"
        onChange={(levelDb) => onEdit((b) => ({ ...b, levelDb }))}
      />
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.driveTip}>Crossover</Tooltip>}
        value={band.drive}
        onChange={(drive) => onEdit((b) => ({ ...b, drive }))}
        options={entriesOf(DRIVE_NAMES)}
      />
      <NumberField
        // passive: the channel it shares
        label={
          <Tooltip tip={AMP_POWER_TIP}>
            {band.drive === HIFI_DRIVE.passive ? SPEAKER_TEXT.sharedAmp : AMP_POWER_LABEL}
          </Tooltip>
        }
        value={band.ampW}
        min={1}
        step={SPEAKER_STEPS.ampW}
        unit="W"
        onChange={(ampW) => onEdit((b) => ({ ...b, ampW }))}
      />
    </Card>
  );
}
