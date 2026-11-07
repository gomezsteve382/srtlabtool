/* HeroShot — GM LAB dashboard hero.
 * A stylized black Escalade-V showroom render on an animated circular turntable.
 * Pure inline SVG; presentation only. */
export function HeroShot() {
  return (
    <svg
      className="hero-art hero-art-showroom"
      viewBox="0 0 1040 430"
      role="img"
      aria-label="Black Escalade-V style full-size performance SUV on a circular showroom turntable"
    >
      <defs>
        <linearGradient id="stageTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#17243A" />
          <stop offset="0.5" stopColor="#0B111D" />
          <stop offset="1" stopColor="#05070C" />
        </linearGradient>
        <linearGradient id="stageEdge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#09111F" />
          <stop offset="0.45" stopColor="#1E6FE0" />
          <stop offset="0.55" stopColor="#8FC1FF" />
          <stop offset="1" stopColor="#09111F" />
        </linearGradient>
        <linearGradient id="bodyBlack" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#39465D" />
          <stop offset="0.15" stopColor="#182233" />
          <stop offset="0.52" stopColor="#0B111C" />
          <stop offset="1" stopColor="#020307" />
        </linearGradient>
        <linearGradient id="bodyHighlight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8FC1FF" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="#8FC1FF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#4E9BFF" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#739BCF" stopOpacity="0.38" />
          <stop offset="0.55" stopColor="#172238" stopOpacity="0.72" />
          <stop offset="1" stopColor="#050911" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="grille" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#080B11" />
          <stop offset="0.5" stopColor="#1C2636" />
          <stop offset="1" stopColor="#05070B" />
        </linearGradient>
        <radialGradient id="floorGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#1E6FE0" stopOpacity="0.36" />
          <stop offset="0.48" stopColor="#1157C2" stopOpacity="0.16" />
          <stop offset="1" stopColor="#1E6FE0" stopOpacity="0" />
        </radialGradient>
        <filter id="heroGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>

      {/* Ambient showroom halo */}
      <ellipse cx="535" cy="333" rx="440" ry="74" fill="url(#floorGlow)" />

      {/* Circular turntable in perspective */}
      <g className="showroom-turntable">
        <ellipse cx="535" cy="330" rx="390" ry="68" fill="#02050A" opacity="0.94" />
        <ellipse cx="535" cy="322" rx="376" ry="61" fill="url(#stageTop)" stroke="#25334A" strokeWidth="1.5" />
        <ellipse cx="535" cy="322" rx="348" ry="51" fill="none" stroke="#152238" strokeWidth="1.4" />
        <ellipse cx="535" cy="337" rx="376" ry="61" fill="none" stroke="url(#stageEdge)" strokeWidth="5" opacity="0.65" />

        <g className="showroom-ring-spin" filter="url(#heroGlow)">
          <ellipse
            cx="535"
            cy="322"
            rx="363"
            ry="56"
            fill="none"
            stroke="#4E9BFF"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="52 22 10 26"
          />
        </g>

        <ellipse
          className="showroom-ring-pulse"
          cx="535"
          cy="322"
          rx="382"
          ry="65"
          fill="none"
          stroke="#8FC1FF"
          strokeWidth="1"
          opacity="0.18"
        />
      </g>

      {/* vehicle shadow */}
      <ellipse cx="548" cy="302" rx="278" ry="34" fill="#000" opacity="0.78" filter="url(#softShadow)" />

      {/* Escalade-V style SUV — three-quarter front profile */}
      <g className="escalade-v">
        {/* rear body mass */}
        <path
          d="M220 275
             L228 184
             Q230 166 250 160
             L522 148
             Q560 147 584 158
             L704 205
             L821 226
             Q845 231 854 249
             L865 276
             L850 293
             L244 293
             Q222 290 220 275Z"
          fill="url(#bodyBlack)"
          stroke="#2D3A51"
          strokeWidth="1.3"
        />

        {/* tall roof / Escalade box */}
        <path
          d="M252 163
             L267 116
             Q272 104 290 102
             L530 98
             Q558 98 577 111
             L668 183
             L596 167
             L556 139
             L282 144Z"
          fill="#0B101A"
          stroke="#25324A"
          strokeWidth="1.2"
        />

        {/* roof rail */}
        <path d="M292 95 L522 91" stroke="#40526C" strokeWidth="4" strokeLinecap="round" opacity="0.8" />

        {/* glasshouse */}
        <path
          d="M282 143
             L298 118
             L526 114
             Q546 114 561 125
             L637 182
             L585 171
             L548 146
             L282 151Z"
          fill="url(#glass)"
        />
        <path d="M386 117 L387 150" stroke="#0A0F18" strokeWidth="7" />
        <path d="M494 115 L496 151" stroke="#0A0F18" strokeWidth="7" />
        <path d="M552 127 L548 146" stroke="#0A0F18" strokeWidth="5" />

        {/* character / belt line */}
        <path
          d="M236 180 L554 165 L697 211 L824 231"
          fill="none"
          stroke="url(#bodyHighlight)"
          strokeWidth="3.2"
          filter="url(#heroGlow)"
        />

        {/* rear vertical lamp */}
        <rect x="226" y="194" width="10" height="58" rx="4" fill="#E44B50" opacity="0.9" />
        <rect x="228" y="199" width="5" height="48" rx="2.5" fill="#FF6A6D" opacity="0.7" />

        {/* sculpted lower side */}
        <path d="M252 271 L696 270 L810 280" stroke="#17243A" strokeWidth="5" strokeLinecap="round" />
        <path d="M283 245 L628 239" stroke="#33435C" strokeWidth="1.4" opacity="0.55" />

        {/* front face */}
        <path
          d="M704 205
             L823 226
             Q849 231 855 250
             L862 278
             L821 286
             L789 230
             L699 214Z"
          fill="#080D15"
          stroke="#2A3549"
          strokeWidth="1.4"
        />

        {/* signature black grille */}
        <path
          d="M788 224
             L836 235
             Q844 238 847 248
             L852 276
             L805 281
             L792 262Z"
          fill="url(#grille)"
          stroke="#3C4C64"
          strokeWidth="1.4"
        />
        <g opacity="0.5">
          <path d="M802 234 L840 242" stroke="#50617A" />
          <path d="M805 244 L843 251" stroke="#50617A" />
          <path d="M807 254 L845 260" stroke="#50617A" />
          <path d="M809 264 L847 269" stroke="#50617A" />
        </g>

        {/* vertical LED signature */}
        <rect x="777" y="219" width="8" height="54" rx="4" fill="#8FC1FF" opacity="0.92" filter="url(#heroGlow)" />
        <rect x="788" y="218" width="4" height="26" rx="2" fill="#D7E9FF" opacity="0.95" />

        {/* V-series accent badge */}
        <g transform="translate(694 222)">
          <path d="M0 0 L6 0 L11 13 L16 0 L22 0 L14 22 L8 22 Z" fill="#F7FAFF" opacity="0.92" />
          <path d="M23 1 L29 1 L24 8 L19 8 Z" fill="#EF5350" />
          <path d="M26 9 L32 9 L27 16 L22 16 Z" fill="#4E9BFF" />
        </g>

        {/* wheels */}
        <g>
          <circle cx="348" cy="277" r="58" fill="#020307" />
          <circle cx="348" cy="277" r="47" fill="#0B1019" stroke="#313E53" strokeWidth="8" />
          <circle cx="348" cy="277" r="30" fill="#060A10" stroke="#4E9BFF" strokeOpacity="0.5" strokeWidth="2" />
          <g stroke="#4C5C73" strokeWidth="4" strokeLinecap="round">
            <path d="M348 249 L348 305" />
            <path d="M320 277 L376 277" />
            <path d="M328 257 L368 297" />
            <path d="M368 257 L328 297" />
          </g>
          <circle cx="348" cy="277" r="8" fill="#1E293A" />

          <circle cx="730" cy="276" r="58" fill="#020307" />
          <circle cx="730" cy="276" r="47" fill="#0B1019" stroke="#313E53" strokeWidth="8" />
          <circle cx="730" cy="276" r="30" fill="#060A10" stroke="#4E9BFF" strokeOpacity="0.5" strokeWidth="2" />
          <g stroke="#4C5C73" strokeWidth="4" strokeLinecap="round">
            <path d="M730 248 L730 304" />
            <path d="M702 276 L758 276" />
            <path d="M710 256 L750 296" />
            <path d="M750 256 L710 296" />
          </g>
          <circle cx="730" cy="276" r="8" fill="#1E293A" />
        </g>

        {/* gloss hits */}
        <path d="M272 158 Q410 138 546 147" fill="none" stroke="#D4E7FF" strokeOpacity="0.15" strokeWidth="2" />
        <path d="M606 178 L696 210" stroke="#8FC1FF" strokeOpacity="0.22" strokeWidth="2" />
      </g>

      {/* floating showroom caption */}
      <g opacity="0.72">
        <text x="824" y="365" fill="#8FC1FF" fontSize="10" fontWeight="700" letterSpacing="2.2">
          ESCALADE-V
        </text>
        <text x="824" y="381" fill="#7C8BA5" fontSize="8" letterSpacing="1.6">
          PERFORMANCE PLATFORM
        </text>
      </g>
    </svg>
  );
}
