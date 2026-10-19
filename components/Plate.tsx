// A bumper plate, drawn in the split day's color. Used for the big "today" hero and the weekly plates.
export default function Plate({
  color, size = 48, filled = true, label, ink = "#FFFFFF",
}: { color: string; size?: number; filled?: boolean; label?: string; ink?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      {filled ? (
        <>
          <circle cx="50" cy="50" r="48" fill={color} />
          <circle cx="50" cy="50" r="38" fill="none" stroke={ink} strokeOpacity="0.18" strokeWidth="2" />
          <circle cx="50" cy="50" r="13" fill="#E6E8EB" />
          <circle cx="50" cy="50" r="13" fill="none" stroke={ink} strokeOpacity="0.25" strokeWidth="2" />
        </>
      ) : (
        <>
          <circle cx="50" cy="50" r="46" fill="none" stroke="#9AA1AD" strokeWidth="3" strokeDasharray="6 6" />
          <circle cx="50" cy="50" r="13" fill="none" stroke="#9AA1AD" strokeWidth="3" />
        </>
      )}
    </svg>
  );
}