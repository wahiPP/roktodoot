import type { Lang } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";

const TEXT: Record<Lang, { ring: string; title: string; body: string }[]> = {
  en: [
    { ring: "5 km", title: "Five closest donors", body: "Only people who can give this group and have rested long enough." },
    { ring: "10 km", title: "Fifteen more", body: "If nobody says yes in 10 minutes (5 if critical), the search widens." },
    { ring: "25 km", title: "Everyone eligible", body: "Every remaining donor in range is asked at once." },
    { ring: "Banks", title: "Nearest blood banks", body: "Their numbers appear on your screen and a volunteer is alerted." },
  ],
  bn: [
    { ring: "৫ কিমি", title: "সবচেয়ে কাছের পাঁচজন", body: "শুধু যাঁরা এই গ্রুপে দিতে পারেন এবং যাঁদের বিশ্রাম শেষ।" },
    { ring: "১০ কিমি", title: "আরও পনেরোজন", body: "১০ মিনিটে (জরুরি হলে ৫) কেউ রাজি না হলে খোঁজ বাড়ে।" },
    { ring: "২৫ কিমি", title: "সব উপযুক্ত রক্তদাতা", body: "এলাকার বাকি সবাইকে একসাথে জানানো হয়।" },
    { ring: "ব্যাংক", title: "কাছের ব্লাড ব্যাংক", body: "তাদের নম্বর আপনার স্ক্রিনে আসে, স্বেচ্ছাসেবককে জানানো হয়।" },
  ],
};

const ICONS: IconName[] = ["radar", "group", "group", "bank"];

/** How the search widens, as an illustration and a list. */
export function RingsDiagram({ lang = "en" }: { lang?: Lang }) {
  const dots: [number, number, string][] = [
    [112, 96, "fill-tertiary"], [128, 118, "fill-tertiary"], [96, 124, "fill-outline"], [150, 92, "fill-tertiary"],
    [70, 70, "fill-outline-variant"], [176, 150, "fill-outline-variant"], [60, 152, "fill-success"], [190, 70, "fill-outline-variant"],
    [30, 110, "fill-outline-variant"], [215, 120, "fill-outline-variant"], [120, 22, "fill-outline-variant"],
  ];
  return (
    <div className="grid gap-4">
      <svg viewBox="0 0 240 240" className="mx-auto w-48" role="img" aria-label="Search rings at 5, 10 and 25 km around the hospital">
        <circle cx="120" cy="120" r="110" className="fill-none stroke-primary" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.4" />
        <circle cx="120" cy="120" r="70" className="fill-none stroke-primary" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.6" />
        <circle cx="120" cy="120" r="34" className="ring-active fill-primary/10 stroke-primary" strokeWidth="3" />
        {dots.map(([x, y, c], i) => (
          <circle key={i} cx={x} cy={y} r="5.5" className={`${c} stroke-surface`} strokeWidth="2" />
        ))}
        <rect x="108" y="108" width="24" height="24" rx="8" className="fill-primary" />
        <path d="M120 113v14M113 120h14" className="stroke-on-primary" strokeWidth="3" />
      </svg>
      <ul className="divide-y divide-outline-variant">
        {TEXT[lang].map((s, i) => (
          <li key={s.ring} className="flex gap-4 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-container text-on-primary-container">
              <Icon name={ICONS[i]} size={20} />
            </span>
            <span>
              <span className="block text-title-s text-on-surface">
                {s.title} <span className="font-normal text-primary">· {s.ring}</span>
              </span>
              <span className="block text-body-m text-on-surface-variant">{s.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
