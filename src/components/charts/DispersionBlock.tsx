import { DispersionPlaneToggle } from "../ui/DispersionPlaneToggle";
import { DispersionMap } from "./DispersionMap";
import { DISPERSION_AXIS_NAMES, dispersionMapTitle } from "../../constants/dispersionPlanes";
import type { DispersionPlane, HifiDispersionMap } from "../../types";

interface Props {
  map: HifiDispersionMap;
  plane: DispersionPlane;
  onPlane: (plane: DispersionPlane) => void;
  /** the distance the map is worked out at, m */
  distM: number;
  /** what its 0° is on */
  axis: keyof typeof DISPERSION_AXIS_NAMES;
}

/** A dispersion map with its Horizontal / Vertical buttons and its title: the PA, Speaker and Stack pages' alike. */
export function DispersionBlock({ map, plane, onPlane, distM, axis }: Props) {
  return (
    <>
      <DispersionPlaneToggle value={plane} onChange={onPlane} />
      <DispersionMap map={map} title={dispersionMapTitle(plane, distM, axis)} />
    </>
  );
}
