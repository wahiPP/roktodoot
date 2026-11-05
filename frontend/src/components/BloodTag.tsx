/** Blood group shown as an M3 tonal container, sized like an avatar. */

const SIZE = {
  sm: "h-8 min-w-8 px-1.5 text-title-s rounded-sm",
  md: "h-12 min-w-12 px-2 text-title-l rounded-md",
  lg: "h-14 min-w-14 px-2.5 text-headline-s rounded-lg",
  xl: "h-20 min-w-20 px-3 text-headline-l rounded-lg",
};

export function splitGroup(group: string): { abo: string; rh: string } {
  const m = /^(AB|A|B|O)([+-])$/.exec(group);
  return m ? { abo: m[1], rh: m[2] } : { abo: "", rh: "" };
}

export function BloodTag({ group, size = "md" }: { group: string | null; size?: keyof typeof SIZE }) {
  if (!group) {
    return (
      <span className={`inline-grid shrink-0 place-items-center bg-surface-container-highest font-medium text-on-surface-variant ${SIZE[size]}`}>
        ?
      </span>
    );
  }
  const { abo, rh } = splitGroup(group);
  return (
    <span
      className={`inline-grid shrink-0 place-items-center bg-primary-container font-medium text-on-primary-container ${SIZE[size]}`}
      aria-label={`Blood group ${abo} ${rh === "+" ? "positive" : "negative"}`}
      data-abo={abo}
    >
      <span aria-hidden="true">
        {abo}
        {rh === "+" ? "+" : "−"}
      </span>
    </span>
  );
}
