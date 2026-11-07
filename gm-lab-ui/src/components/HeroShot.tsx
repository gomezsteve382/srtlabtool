/* HeroShot — the GM LAB dashboard hero: a black Escalade-class SUV silhouette
 * with blue rim-light and studio floor reflection. 100% original SVG artwork
 * (no copyrighted assets): hand-drawn bezier silhouette, layered gradients,
 * glow filters, mirror reflection. */
export function HeroShot() {
  return (
    <svg
      className="hero-art"
      viewBox="0 0 980 340"
      role="img"
      aria-label="Black GM full-size SUV studio render with blue rim light"
    >
      <defs>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A3549" />
          <stop offset="0.45" stopColor="#141B29" />
          <stop offset="1" stopColor="#05070C" />
        </linearGradient>
        <linearGradient id="rimLight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4E9BFF" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#8FC1FF" stopOpacity="0.35" />
          <stop offset="1" stopColor="#4E9BFF" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8FC1FF" stopOpacity="0.5" />
          <stop offset="1" stopColor="#1E6FE0" stopOpacity="0.08" />
        </linearGradient>
        <radialGradient id="floorGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#1E6FE0" stopOpacity="0.4" />
          <stop offset="1" stopColor="#1E6FE0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="reflectGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4E9BFF" stopOpacity="0.22" />
          <stop offset="1" stopColor="#4E9BFF" stopOpacity="0" />
        </linearGradient>
        <filter id="blueGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* studio floor */}
      <ellipse cx="490" cy="292" rx="430" ry="34" fill="url(#floorGlow)" />
      <line x1="60" y1="290" x2="920" y2="290" stroke="#1C2536" strokeWidth="1" />

      {/* reflection (mirrored silhouette, faded) */}
      <g transform="translate(0,581) scale(1,-1)" opacity="0.5">
        <use href="#suvSilhouette" fill="url(#reflectGrad)" stroke="none" />
      </g>

      {/* the SUV */}
      <g id="suvSilhouette">
        {/* wheel arch cutouts (punched with background color so body reads around them) */}
        <g>
          <path
            d="M 170 272
               L 170 180
               Q 170 170 182 168
               L 540 162
               L 610 200
               Q 622 206 648 208
               L 772 214
               Q 796 217 800 230
               L 806 258
               Q 806 270 794 271
               L 170 272 Z"
            fill="url(#bodyGrad)"
          />
        </g>
        {/* roof */}
        <path
          d="M 178 168
             L 178 152
             Q 178 146 188 145
             L 520 140
             Q 546 139 556 143
             L 548 160
             L 200 166
             Q 180 168 178 168 Z"
          fill="#0A0F19"
        />
        {/* roof rails */}
        <rect x="196" y="136" width="300" height="5" rx="2.5" fill="#111827" stroke="#22304A" strokeWidth="1" />
        {/* glasshouse — dark band with thin bright separators (Escalade blackout pillars) */}
        <path
          d="M 196 164
             L 544 158
             L 588 198
             L 620 204
             L 620 210
             L 196 210 Z"
          fill="url(#glassGrad)"
          opacity="0.6"
        />
        <path d="M 316 161 L 316 207" stroke="#141B29" strokeWidth="5" />
        <path d="M 452 158 L 452 205" stroke="#141B29" strokeWidth="5" />
        {/* beltline rim light — high, straight, full length */}
        <path
          d="M 172 178 L 540 168 L 590 200 L 622 206 L 776 216"
          fill="none"
          stroke="url(#rimLight)"
          strokeWidth="2.6"
          filter="url(#blueGlow)"
        />
        {/* upright rear — tailgate + vertical tail lamp */}
        <path d="M 174 182 L 158 184 L 156 262 L 172 264 Z" fill="url(#bodyGrad)" />
        <path d="M 166 192 L 160 193 L 160 232 L 166 231 Z" fill="#EF5350" opacity="0.8" filter="url(#blueGlow)" />
        {/* front — big upright grille + stacked vertical DRLs */}
        <rect x="788" y="222" width="18" height="42" rx="3" fill="#0B1322" stroke="#2A3549" strokeWidth="1.4" />
        <path d="M 794 230 L 800 230 M 794 240 L 800 240 M 794 250 L 800 250" stroke="#3E5C8A" strokeWidth="2.5" />
        <path d="M 780 214 L 788 216 L 788 236 L 780 234 Z" fill="#8FC1FF" opacity="0.9" filter="url(#blueGlow)" />
        <path d="M 780 244 L 788 246 L 788 262 L 780 260 Z" fill="#8FC1FF" opacity="0.55" filter="url(#blueGlow)" />
        {/* hood + fender line */}
        <path d="M 640 210 L 778 218" stroke="#2A3549" strokeWidth="1.6" />
        {/* lower accent */}
        <path d="M 176 262 L 792 264" stroke="#4E9BFF" strokeOpacity="0.3" strokeWidth="1.4" />
        {/* wheels — big 22s tucked in dark arches */}
        <g>
          <circle cx="286" cy="254" r="52" fill="#04060B" />
          <circle cx="286" cy="254" r="40" fill="#05070C" stroke="#2A3549" strokeWidth="7" />
          <circle cx="286" cy="254" r="24" fill="none" stroke="#4E9BFF" strokeOpacity="0.55" strokeWidth="2.2" />
          <circle cx="286" cy="254" r="8" fill="#1C2536" />
          <circle cx="700" cy="254" r="52" fill="#04060B" />
          <circle cx="700" cy="254" r="40" fill="#05070C" stroke="#2A3549" strokeWidth="7" />
          <circle cx="700" cy="254" r="24" fill="none" stroke="#4E9BFF" strokeOpacity="0.55" strokeWidth="2.2" />
          <circle cx="700" cy="254" r="8" fill="#1C2536" />
        </g>
      </g>
    </svg>
  );
}
