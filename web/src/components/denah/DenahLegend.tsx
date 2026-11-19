import { TONE_STYLE, type DenahTone } from "@/lib/denah-tone";

const TONE_ORDER: DenahTone[] = ["validated", "allocated", "drafted", "empty"];

export function DenahLegend({ counts }: { counts: Record<DenahTone, number> }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      {TONE_ORDER.map((tone) => (
        <li key={tone} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-sm border"
            style={{ backgroundColor: TONE_STYLE[tone].fill, borderColor: TONE_STYLE[tone].stroke }}
          />
          <span className="text-muted-foreground">{TONE_STYLE[tone].label}</span>
          <span className="font-medium">{counts[tone]}</span>
        </li>
      ))}
    </ul>
  );
}
