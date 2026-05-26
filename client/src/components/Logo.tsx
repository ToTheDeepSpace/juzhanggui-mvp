interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 32, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoStroke" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <radialGradient id="logoCore" cx="32" cy="32" r="6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="60%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#818cf8" />
        </radialGradient>
      </defs>

      {/* 子午环（外圈正圆） */}
      <circle cx="32" cy="32" r="26" stroke="url(#logoStroke)" strokeWidth="1.6" opacity="0.95" />

      {/* 赤道环（水平椭圆） */}
      <ellipse cx="32" cy="32" rx="26" ry="9" stroke="url(#logoStroke)" strokeWidth="1.6" opacity="0.85" />

      {/* 黄道环（倾斜椭圆 23.5°） */}
      <ellipse
        cx="32"
        cy="32"
        rx="26"
        ry="9"
        stroke="url(#logoStroke)"
        strokeWidth="1.6"
        opacity="0.85"
        transform="rotate(23.5 32 32)"
      />

      {/* 极轴小刻度 */}
      <line x1="32" y1="2" x2="32" y2="8" stroke="url(#logoStroke)" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="32" y1="56" x2="32" y2="62" stroke="url(#logoStroke)" strokeWidth="1.6" strokeLinecap="round" />

      {/* 中心星核 */}
      <circle cx="32" cy="32" r="4" fill="url(#logoCore)" />

      {/* 四芒星光 */}
      <path
        d="M32 24 L33 31 L40 32 L33 33 L32 40 L31 33 L24 32 L31 31 Z"
        fill="#fef3c7"
        opacity="0.9"
      />
    </svg>
  );
}
