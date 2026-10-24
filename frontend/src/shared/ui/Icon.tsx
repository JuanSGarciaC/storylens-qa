const PATHS = {
  home: "M3 11l9-8 9 8M5 10v10h14V10",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  check: "M4 12l5 5L20 6",
  alert: "M12 3l10 18H2L12 3zM12 10v5M12 18h.01",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  settings: "M12 9a3 3 0 100 6 3 3 0 000-6zM12 2v3M12 19v3M2 12h3M19 12h3",
  bug: "M9 9h6v8a3 3 0 01-6 0V9zM9 5l1 2M15 5l-1 2M4 13h5M15 13h5",
} as const;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
