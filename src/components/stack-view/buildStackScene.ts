import type {
  BoxBracing,
  BoxHardwarePlan,
  BoxKeepOut,
  CompressionDriver,
  Dims3,
  Horn,
  HornMountId,
  MidDriver,
  PaLayout,
  PaPortGeometry,
  PortStyle,
  SubDriver,
} from "../../types";

export interface Props {
  sub: SubDriver & { box: Dims3 };
  mid: MidDriver & { box: Dims3 };
  horn: Horn;
  /** the compression driver behind the horn */
  cd: Pick<CompressionDriver, "body" | "exit">;
  plinth: number;
  cutaway: boolean;
  portStyle: PortStyle;
  layout: PaLayout;
  baffleColor: string;
  /** a paint color (hex) for the horn body; absent or empty: the horn's catalog finish */
  hornColor?: string;
  /** what holds a driver bolted straight to its horn on the mid box's lid; absent: the aluminum plate */
  hornMount?: HornMountId;
  /** explicit vent geometry when the cabinet is custom */
  portGeom?: Partial<PaPortGeometry>;
  wall?: number;
  inset?: number;
  /** a `FinishId` or a paint color (hex) */
  cabFinish?: string;
  spacerH?: number;
  /** the boxes' braces and ribs (lib/bracing), drawn inside them (they show in the cutaway) */
  subBracing?: BoxBracing;
  midBracing?: BoxBracing | null;
  /** what each box's braces keep clear of (lib/pa/calc): their drivers are drawn in the cutaway */
  subKeepOut?: BoxKeepOut;
  midKeepOut?: BoxKeepOut | null;
  /** each box's handles, input dish and horn posts (lib/pa/hardware), drawn on its faces */
  subHardware?: BoxHardwarePlan;
  midHardware?: BoxHardwarePlan | null;
}
