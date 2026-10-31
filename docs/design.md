# Interface design

The interface follows **Google Material Design 3** (Material You), built with Tailwind CSS on M3 design tokens. The shared components live in `frontend/src/components/md.tsx`.

## Colour

An M3 colour scheme generated from a blood-red seed (`#B3261E`), with every M3 colour role defined as a CSS variable in `frontend/src/app/globals.css`:

- **primary / primary-container:** main actions, the blood group badge, the ring being searched
- **secondary-container:** selected chips, the active navigation item, tonal buttons
- **tertiary-container:** waiting and "held for review" states
- **success / success-container:** a custom colour role for "donor found" and calling the donor
- **surface and surface-container levels:** page and card backgrounds

There is a full **dark scheme** as well. It switches automatically with the phone's setting, which matters because many blood searches happen at night.

## Type

Roboto for Latin text and Noto Sans Bengali for Bangla, both self-hosted so the app works offline. Sizes follow the M3 type scale (display, headline, title, body, label), defined in `tailwind.config.ts`.

## Components

| M3 component | Where it is used |
|---|---|
| Small top app bar | Every page, with the language switch and sign out |
| Navigation bar | Bottom of the screen on phones |
| Navigation rail | Left side on tablets and desktops |
| Filled, tonal, outlined and text buttons | Primary, secondary and low-emphasis actions |
| Extended FAB | "New request" on the requests list |
| Outlined text fields with floating labels | All forms |
| Filter chips | Choosing a blood group |
| Suggestion chips | Example messages on the home page |
| Elevated, filled and outlined cards | Request summary, donor requests, admin statistics |
| Lists | Requests, alerts, blood banks, the agent timeline |
| Switch | Donor availability |
| Linear progress | Time left in the current wave |
| Snackbar | Confirmations, such as saving a profile or answering a request |

Interactive elements use M3 **state layers** (a colour overlay on hover, focus and press). Icons are Material Symbols (Rounded). Only the icons the app uses are inlined, about 22 KB instead of a 5 MB icon font.

## Shape and elevation

The M3 shape scale (4, 8, 12, 16 and 28 px, plus full pill) and elevation levels 1 to 3 are Tailwind tokens. Buttons are pills, cards use 12 px corners, and the FAB uses 16 px.

## The search made visible

- The home page explains the process with the same rings the live map uses (`RingsDiagram.tsx`).
- Request pages show a stepper (5 km, 10 km, 25 km, banks) and a countdown card with a progress bar on the map.
- The admin page shows the trust score on a track with the reject (below 30), hold (30 to 59) and publish (60 and above) bands.

## Motion

Only the ring being searched pulses on its own. Everything else animates only in response to the user, using the M3 emphasised easing curve. The pulse is switched off when the device asks for reduced motion.
