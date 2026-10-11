import type { BandId, SpeakerBand } from "../../types";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { NumberField } from "../../components/ui/NumberField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { entriesOf } from "../../lib/records";
import { BAND_NAMES, DESIGNER_TEXT, DRIVE_NAMES } from "../../constants/designer";
import { FilterFields } from "./FilterFields";
import { HIFI_DRIVE } from "../../constants/hifiEngine";

interface Props {
  band: SpeakerBand;
  /** the band ids it may take: its own and those no other band has */
  freeIds: readonly BandId[];
  /** a new filter's corner, Hz */
  newCornerHz: number;
  onEdit: (edit: (band: SpeakerBand) => SpeakerBand) => void;
  /** gives the band another id (its drivers follow) */
  onRename: (id: BandId) => void;
  /** absent for the last band left */
  onRemove?: () => void;
}

/** One band's settings: its id, highpass and lowpass, level, drive and amp power. */
export function BandSettings({ band, freeIds, newCornerHz, onEdit, onRename, onRemove }: Props) {
  return (
    <Card className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="font-semibold">{BAND_NAMES[band.id]} band</h4>
        {onRemove && (
          <Button size="xs" onClick={onRemove}>
            Remove band
          </Button>
        )}
      </div>
      <ToggleGroup
        label="Band"
        className="mb-3"
        value={band.id}
        onChange={onRename}
        options={freeIds.map((id) => [id, BAND_NAMES[id]] as const)}
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
