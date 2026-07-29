const WAVE_LINES = Array.from({ length: 24 }, (_, index) => index)

/**
 * Decorative CAC backdrop for the dark dashboard only.
 * The CSS hides this layer completely in light mode.
 */
export function DarkBrandBackdrop() {
  return (
    <div className="dark-brand-backdrop" aria-hidden="true">
      <span className="dark-brand-orb dark-brand-orb--blue" />
      <span className="dark-brand-orb dark-brand-orb--red" />

      <svg
        className="dark-brand-wave dark-brand-wave--blue"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <linearGradient id="cac-wave-blue" x1="0" y1="0" x2="1600" y2="600">
            <stop offset="0" stopColor="#1728D7" stopOpacity="0" />
            <stop offset="0.24" stopColor="#1728D7" stopOpacity="0.2" />
            <stop offset="0.58" stopColor="#315CFF" stopOpacity="0.8" />
            <stop offset="0.84" stopColor="#4D8DFF" stopOpacity="0.28" />
            <stop offset="1" stopColor="#4D8DFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g stroke="url(#cac-wave-blue)" strokeWidth="1.1">
          {WAVE_LINES.map((line) => (
            <path
              key={`blue-${line}`}
              d={`M -140 ${72 + line * 9}
                  C ${110 + line * 2} ${10 + line * 6},
                    ${270 + line * 3} ${260 - line * 5},
                    ${520 + line * 2} ${148 + line * 2}
                  S ${870 - line * 2} ${28 + line * 7},
                    ${1110 + line * 2} ${145 + line * 2}
                  S ${1435 + line * 2} ${286 - line * 6},
                    1740 ${86 + line * 5}`}
            />
          ))}
        </g>
      </svg>

      <svg
        className="dark-brand-wave dark-brand-wave--red"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <linearGradient id="cac-wave-red" x1="0" y1="760" x2="1600" y2="380">
            <stop offset="0" stopColor="#E5122D" stopOpacity="0" />
            <stop offset="0.2" stopColor="#E5122D" stopOpacity="0.28" />
            <stop offset="0.52" stopColor="#FF2448" stopOpacity="0.78" />
            <stop offset="0.78" stopColor="#C61D55" stopOpacity="0.22" />
            <stop offset="1" stopColor="#C61D55" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g stroke="url(#cac-wave-red)" strokeWidth="1.05">
          {WAVE_LINES.map((line) => (
            <path
              key={`red-${line}`}
              d={`M -180 ${758 - line * 8}
                  C ${80 + line * 3} ${530 + line * 5},
                    ${340 - line * 2} ${880 - line * 6},
                    ${635 + line * 3} ${690 + line * 2}
                  S ${1040 - line * 2} ${486 + line * 5},
                    ${1325 + line * 2} ${690 - line * 3}
                  S ${1620 + line * 3} ${842 - line * 7},
                    1780 ${610 + line * 3}`}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
