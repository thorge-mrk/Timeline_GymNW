/**
 * Das Fuchs-Zeichen der Schule als Vektor — nachgezeichnet aus dem offiziellen
 * Logo (gym-nw.de), damit es in jeder Größe gestochen scharf bleibt.
 * Das vollständige Rund-Logo liegt zusätzlich als /logo-gymnw.png im public-Ordner.
 */
export default function SchoolMark({
  className = "",
  title = "Gymnasium Neu Wulmstorf",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 195 312"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
    >
      <path
        d="M8 12 L8 220 L187 302 L187 10 L101 88 Z"
        stroke="currentColor"
        strokeWidth={15}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
