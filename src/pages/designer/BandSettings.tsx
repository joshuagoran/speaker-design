import type { SpeakerBand } from "../../types";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { NumberField } from "../../components/ui/NumberField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { TextField } from "../../components/ui/TextField";
import { entriesOf } from "../../lib/records";
import { DESIGNER_TEXT, DRIVE_NAMES } from "../../constants/designer";
import { FilterFields } from "./FilterFields";
import { HIFI_DRIVE } from "../../constants/hifiEngine";

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
    <Card className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="font-semibold">{band.name}</h4>
        {onRemove && (
          <Button size="xs" onClick={onRemove}>
            Remove band
          </Button>
        )}
      </div>
      <TextField
        label="Name"
        value={band.name}
        maxLength={30}
        onChange={(name) => onEdit((b) => ({ ...b, name }))}
      />
      <FilterFields
        filters={band}
        newCornerHz={newCornerHz}
        offName={DESIGNER_TEXT.noFilter}
        onEdit={(edit) => onEdit((b) => ({ ...b, ...edit(b) }))}
      />
      <NumberField
        label="Level"
        // shown to 0.1 dB (the Hi-fi level match is exact)
        value={Math.round(band.levelDb * 10) / 10}
        step={0.5}
        unit="dB"
        onChange={(levelDb) => onEdit((b) => ({ ...b, levelDb }))}
      />
      <ToggleGroup
        label="Drive"
        value={band.drive}
        onChange={(drive) => onEdit((b) => ({ ...b, drive }))}
        options={entriesOf(DRIVE_NAMES)}
      />
      <NumberField
        // passive: the channel it shares
        label={band.drive === HIFI_DRIVE.passive ? "Shared amp channel" : "Amp power"}
        value={band.ampW}
        min={1}
        step={10}
        unit="W"
        onChange={(ampW) => onEdit((b) => ({ ...b, ampW }))}
      />
    </Card>
  );
}
