import type { Config } from "tailwindcss";

// Material Design 3 colour roles, read from CSS variables so light and dark
// schemes can switch (see globals.css). Seed colour: blood red #B3261E.
const role = (name: string) => `rgb(var(--md-${name}) / <alpha-value>)`;
const roles = [
  "primary", "on-primary", "primary-container", "on-primary-container",
  "secondary", "on-secondary", "secondary-container", "on-secondary-container",
  "tertiary", "on-tertiary", "tertiary-container", "on-tertiary-container",
  "success", "on-success", "success-container", "on-success-container",
  "error", "on-error", "error-container", "on-error-container",
  "surface", "on-surface", "on-surface-variant", "outline", "outline-variant",
  "surface-container-lowest", "surface-container-low", "surface-container",
  "surface-container-high", "surface-container-highest",
  "inverse-surface", "inverse-on-surface", "inverse-primary", "scrim",
];

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: Object.fromEntries(roles.map((r) => [r, role(r)])),
      fontFamily: {
        sans: ['"Roboto Variable"', '"Noto Sans Bengali Variable"', "system-ui", "sans-serif"],
      },
      // M3 type scale
      fontSize: {
        "display-l": ["57px", { lineHeight: "64px", letterSpacing: "-0.25px" }],
        "display-m": ["45px", { lineHeight: "52px" }],
        "display-s": ["36px", { lineHeight: "44px" }],
        "headline-l": ["32px", { lineHeight: "40px" }],
        "headline-m": ["28px", { lineHeight: "36px" }],
        "headline-s": ["24px", { lineHeight: "32px" }],
        "title-l": ["22px", { lineHeight: "28px" }],
        "title-m": ["16px", { lineHeight: "24px", letterSpacing: "0.15px", fontWeight: "500" }],
        "title-s": ["14px", { lineHeight: "20px", letterSpacing: "0.1px", fontWeight: "500" }],
        "body-l": ["16px", { lineHeight: "24px", letterSpacing: "0.5px" }],
        "body-m": ["14px", { lineHeight: "20px", letterSpacing: "0.25px" }],
        "body-s": ["12px", { lineHeight: "16px", letterSpacing: "0.4px" }],
        "label-l": ["14px", { lineHeight: "20px", letterSpacing: "0.1px", fontWeight: "500" }],
        "label-m": ["12px", { lineHeight: "16px", letterSpacing: "0.5px", fontWeight: "500" }],
        "label-s": ["11px", { lineHeight: "16px", letterSpacing: "0.5px", fontWeight: "500" }],
      },
      // M3 shape scale
      borderRadius: { xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "28px" },
      // M3 elevation levels
      boxShadow: {
        "elev-1": "0 1px 2px 0 rgb(0 0 0 / 0.3), 0 1px 3px 1px rgb(0 0 0 / 0.15)",
        "elev-2": "0 1px 2px 0 rgb(0 0 0 / 0.3), 0 2px 6px 2px rgb(0 0 0 / 0.15)",
        "elev-3": "0 1px 3px 0 rgb(0 0 0 / 0.3), 0 4px 8px 3px rgb(0 0 0 / 0.15)",
      },
      transitionTimingFunction: { emphasized: "cubic-bezier(0.2, 0, 0, 1)" },
    },
  },
  plugins: [],
};
export default config;
