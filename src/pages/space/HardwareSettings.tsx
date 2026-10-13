import type { AmpId, SpaceAmp, SpaceDesign } from "../../types";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField, type SelectOption } from "../../components/ui/SelectField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Notice } from "../../components/ui/Notice";
import { AMP_SERIES } from "../../data/catalog/amps";
import { DSP_UNITS } from "../../lib/data";
import { byId } from "../../lib/tables";
import { assignChannel, channelGroups, hardwareGaps } from "../../lib/speaker/spaceHardware";
import { placementStack, resolvedPlacement } from "../../lib/speaker/spaceLayout";
import { FRONT_END_KIND } from "../../constants/speakerSpec";
import { FRONT_END_NAMES, FRONT_END_TIPS, NO_FRONT_END, SPACE_TEXT } from "../../constants/space";
import type { SpacePlanner } from "./useSpace";
import { spaceAmpPower } from "../../lib/speaker/spaceAmpPower";
import { AmpPowerRows } from "../../components/stats/AmpPowerRows";
import { CardHeading } from "../../components/ui/CardHeading";
import { AMP_POWER_TEXT } from "../../constants/ampPower";

/** The amp picker's choices: every catalog model, its brand, channels and 8 Ω power. */
const AMP_OPTIONS: readonly (SelectOption & { amp: AmpId; watts: number })[] = AMP_SERIES.flatMap(
  (series) =>
    series.models.map((m) => ({
      id: m.id,
      amp: m.id,
      watts: m.w8,
      name: `${series.brand} ${m.model} (${m.channels} × ${m.w8} W)`,
    })),
);
/** The choice for an amp that isn't in the catalog: its power typed in. */
const CUSTOM_AMP: SelectOption = { id: "custom", name: SPACE_TEXT.customAmp };
/** The choice for a band group on no channel. */
const NO_CHANNEL: SelectOption = { id: "none", name: SPACE_TEXT.unassigned };
/** The DSP picker's choice for a unit the catalog doesn't list. */
const OTHER_DSP: SelectOption = { id: "other", name: SPACE_TEXT.noDsp };
/** The DSP picker's choices: the catalog's units, and one for any other. */
const DSP_OPTIONS: readonly SelectOption[] = [
  ...DSP_UNITS.map((u) => ({ id: u.id, name: u.row.unit })),
  OTHER_DSP,
];
/** A new amp's power before a model is picked, W per channel. */
const NEW_AMP_W = 500;

/** The front end's choices: none, an analog crossover, or a DSP. */
const FRONT_ENDS = [
  [NO_FRONT_END, FRONT_END_NAMES[NO_FRONT_END], FRONT_END_TIPS[NO_FRONT_END]],
  [FRONT_END_KIND.analog, FRONT_END_NAMES.analog, FRONT_END_TIPS.analog],
  [FRONT_END_KIND.digital, FRONT_END_NAMES.digital, FRONT_END_TIPS.digital],
] as const;

interface Props {
  design: SpaceDesign;
  /** each placement's name, in the space's order */
  names: readonly string[];
  space: Pick<
    SpacePlanner,
    "setFrontEnd" | "addAmp" | "editAmp" | "removeAmp" | "editPlacement" | "model" | "gain"
  >;
}

/**
 * The hardware the space assigns: the front end (none, analog, or a DSP), the amps (a catalog model or a power typed
 * in), and which amp gives a channel to each band group of each placement's members.
 */
export function HardwareSettings({ design, names, space }: Props) {
  const { amps, frontEnd, placements } = design.space;
  /** each channel's power at the space's level */
  const power = spaceAmpPower(space.model, amps, space.gain);
  const gaps = hardwareGaps(design);
  const ampName = (a: SpaceAmp, i: number) =>
    `${SPACE_TEXT.amp(i + 1)}${a.model ? ` · ${byId(AMP_OPTIONS, a.model)?.name ?? a.model}` : ` · ${a.watts} W`}`;
  const ampOptions: SelectOption[] = [
    NO_CHANNEL,
    ...amps.map((a, i) => ({ id: a.id, name: ampName(a, i) })),
  ];
  return (
    <>
      <ToggleGroup
        label={SPACE_TEXT.frontEnd}
        value={frontEnd?.kind ?? NO_FRONT_END}
        onChange={(v) =>
          space.setFrontEnd(v === NO_FRONT_END ? null : { kind: v, dspId: frontEnd?.dspId ?? null })
        }
        options={FRONT_ENDS}
        wrap={false}
        className="mb-3"
      />
      {frontEnd?.kind === FRONT_END_KIND.digital && (
        <SelectField
          label={SPACE_TEXT.dsp}
          options={DSP_OPTIONS}
          value={byId(DSP_OPTIONS, frontEnd.dspId ?? OTHER_DSP.id)}
          onChange={(o) =>
            space.setFrontEnd({ ...frontEnd, dspId: o.id === OTHER_DSP.id ? null : o.id })
          }
        />
      )}
      {!frontEnd && <p className="text-xs text-stone-500 mb-3">{SPACE_TEXT.noFrontEnd}</p>}
      {gaps.analogDelay && <Notice>{SPACE_TEXT.analogDelay}</Notice>}
      <h4 className="font-semibold mt-2 mb-2">{SPACE_TEXT.amps}</h4>
      {amps.map((a, i) => (
        <Card key={a.id} className="mb-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-semibold">{SPACE_TEXT.amp(i + 1)}</span>
            <Button size="xs" onClick={() => space.removeAmp(i)}>
              {SPACE_TEXT.remove}
            </Button>
          </div>
          <SelectField
            label={SPACE_TEXT.ampModel}
            options={[CUSTOM_AMP, ...AMP_OPTIONS]}
            value={a.model ? byId(AMP_OPTIONS, a.model) : CUSTOM_AMP}
            onChange={(o) => {
              const pick = byId(AMP_OPTIONS, o.id);
              space.editAmp(i, (amp) =>
                pick ? { ...amp, model: pick.amp, watts: pick.watts } : { ...amp, model: null },
              );
            }}
          />
          {!a.model && (
            <NumberField
              label={SPACE_TEXT.watts}
              value={a.watts}
              min={1}
              step={50}
              unit="W"
              onChange={(watts) => space.editAmp(i, (amp) => ({ ...amp, watts }))}
            />
          )}
        </Card>
      ))}
      {gaps.over.map((o) => (
        <Notice key={o.amp}>{SPACE_TEXT.channelsOver(o.amp + 1, o.used, o.has)}</Notice>
      ))}
      <Button className="mb-3" onClick={() => space.addAmp({ model: null, watts: NEW_AMP_W })}>
        {SPACE_TEXT.addAmp}
      </Button>
      {placements.map((p, k) => {
        const item = placementStack(design, resolvedPlacement(placements, k).item);
        if (!item) return null;
        return (
          <Card key={k} className="mb-3">
            <h4 className="font-semibold mb-2 min-w-0 truncate">{names[k]}</h4>
            {item.stack.members.map((m, member) => {
              const speaker = item.speakers.find((s) => s.id === m.speakerId);
              if (!speaker) return null;
              return channelGroups(speaker).map((bands) => {
                const on = p.channels.find(
                  (c) => c.member === member && c.bands.some((b) => bands.includes(b)),
                );
                const label = `${item.stack.members.length > 1 ? `${member + 1}. ` : ""}${speaker.name}: ${bands
                  .map((b) => speaker.bands.find((x) => x.id === b)?.name ?? b)
                  .join(" + ")}`;
                return (
                  <SelectField
                    key={`${member}-${bands.join()}`}
                    label={label}
                    options={ampOptions}
                    value={on ? byId(ampOptions, on.amp) : NO_CHANNEL}
                    extra={
                      on ? (
                        <span className="text-xs text-stone-500">
                          {SPACE_TEXT.channel(
                            amps.findIndex((a) => a.id === on.amp) + 1,
                            on.channel + 1,
                          )}
                        </span>
                      ) : undefined
                    }
                    onChange={(o) =>
                      space.editPlacement(k, (pl) => ({
                        ...pl,
                        channels: assignChannel(
                          pl.channels,
                          member,
                          bands,
                          o.id === NO_CHANNEL.id ? null : o.id,
                        ),
                      }))
                    }
                  />
                );
              });
            })}
          </Card>
        );
      })}
      {power.length > 0 && (
        <div className="mb-3">
          <CardHeading className="mb-1">{AMP_POWER_TEXT.heading}</CardHeading>
          <AmpPowerRows
            firstColumn={AMP_POWER_TEXT.channel}
            rows={power.map((r) => {
              const speaker =
                space.model.placements[r.placement]?.response?.members[r.member]?.speaker;
              const band = speaker?.bands.find((b) => b.id === r.band)?.name ?? r.band;
              return {
                key: r.power.channel,
                name: `${r.placement + 1}. ${band} · ${SPACE_TEXT.channel(
                  amps.findIndex((a) => a.id === r.amp) + 1,
                  r.channel + 1,
                )}`,
                power: r.power,
              };
            })}
          />
          <p className="text-xs text-stone-500 mt-1">
            {AMP_POWER_TEXT.spaceNote} {AMP_POWER_TEXT.crestNote}
          </p>
        </div>
      )}
    </>
  );
}
