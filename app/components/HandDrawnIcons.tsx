const IconBase = ({
  size,
  className,
  emoji,
  children,
  filled = false,
}: {
  size: number;
  className: string;
  emoji: string;
  children: React.ReactNode;
  filled?: boolean;
}) => (
  <span
    className={`themed-icon inline-flex items-center justify-center ${className}`}
    style={{ width: size, height: size }}
    aria-hidden="true"
  >
    <span className="themed-icon-emoji" style={{ fontSize: Math.round(size * 1.23), lineHeight: 1 }}>
      {emoji}
    </span>
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} className="themed-icon-svg">
      {children}
    </svg>
  </span>
);

// テーマ対応アイコン: STREETでは絵文字、他テーマではSVG
export const HandDrawnPostIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <IconBase size={size} className={className} emoji="📝">
    <path
      d="M3 5.5C3 5 3.5 4 5 4h14c1 0 2 0.5 2 1.5v13c0 1-1 1.5-2 1.5H5c-1.5 0-2-0.5-2-1.5z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path d="M7 9h10M7 13h7M7 17h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </IconBase>
);

export const HandDrawnTopicIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <IconBase size={size} className={className} emoji="💡">
    <path d="M12 3l9 6v9l-9 5-9-5V9z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2.5" fill="none" />
  </IconBase>
);

export const HandDrawnPeopleIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <IconBase size={size} className={className} emoji="👥">
    <circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="2.5" fill="none" />
    <path d="M3 21c0-4 2.5-7 6-7s6 3 6 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <circle cx="17" cy="7" r="2.5" stroke="currentColor" strokeWidth="2.5" fill="none" />
    <path d="M21 21c0-3-1.5-5-4-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </IconBase>
);

export const HandDrawnSettingsIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <IconBase size={size} className={className} emoji="⚙️">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2.5" fill="none" />
    <path d="M12 2v3M12 19v3M22 12h-3M5 12H2M19.5 4.5l-2 2M6.5 17.5l-2 2M19.5 19.5l-2-2M6.5 6.5l-2-2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </IconBase>
);

export const HandDrawnPlusIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <IconBase size={size} className={className} emoji="➕">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </IconBase>
);

export const HandDrawnHeartIcon = ({ size = 24, className = "", filled = false }: { size?: number; className?: string; filled?: boolean }) => (
  <IconBase size={size} className={className} emoji="💖" filled={filled}>
    <path d="M12 21s-8-5-8-11c0-3 2-5 4.5-5 1.5 0 3 1 3.5 2.5C12.5 6 14 5 15.5 5c2.5 0 4.5 2 4.5 5 0 6-8 11-8 11z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </IconBase>
);

export const HandDrawnCommentIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <IconBase size={size} className={className} emoji="💬">
    <path d="M4 6c0-1 1-2 2-2h12c1 0 2 1 2 2v9c0 1-1 2-2 2H9l-5 4v-4c-1 0-1-1-1-2V6z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </IconBase>
);

export const LiquidMetalPostIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <IconBase size={size} className={className} emoji="📝">
    <path d="M4 5.5C4 4.7 4.7 4 5.5 4h13c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5h-13c-.8 0-1.5-.7-1.5-1.5z" fill="#ffffff" />
    <rect x="7" y="8" width="10" height="1.6" fill="#000000" opacity="0.35" />
    <rect x="7" y="11.5" width="7.8" height="1.6" fill="#000000" opacity="0.35" />
    <rect x="7" y="15" width="9" height="1.6" fill="#000000" opacity="0.35" />
  </IconBase>
);

export const LiquidMetalTopicIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <IconBase size={size} className={className} emoji="💡">
    <path d="M12 3l8 5v8l-8 5-8-5V8z" fill="#ffffff" />
    <circle cx="12" cy="12" r="3" fill="#000000" opacity="0.35" />
  </IconBase>
);

export const LiquidMetalPeopleIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <IconBase size={size} className={className} emoji="👥">
    <circle cx="9" cy="8" r="3.1" fill="#ffffff" />
    <circle cx="16.5" cy="8.7" r="2.3" fill="#ffffff" />
    <path d="M3.6 19c0-3.4 2.4-5.9 5.4-5.9s5.4 2.5 5.4 5.9" fill="#ffffff" />
    <path d="M13.3 19c.2-2.2 1.6-3.8 3.6-4.1 1.5-.2 2.6.7 2.6 2.3V19" fill="#ffffff" />
  </IconBase>
);

export const LiquidMetalBoardIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <IconBase size={size} className={className} emoji="💬">
    <path d="M4 6.5C4 5.1 5.1 4 6.5 4h11C18.9 4 20 5.1 20 6.5v7c0 1.4-1.1 2.5-2.5 2.5h-5L8 20v-4H6.5C5.1 16 4 14.9 4 13.5z" fill="#ffffff" />
    <rect x="7" y="8" width="10" height="1.5" fill="#000000" opacity="0.3" />
    <rect x="7" y="11.2" width="7" height="1.5" fill="#000000" opacity="0.3" />
  </IconBase>
);

export const ChromeSettingsIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
    <rect x="11" y="1.5" width="2" height="4" fill="#ffffff" />
    <rect x="11" y="18.5" width="2" height="4" fill="#ffffff" />
    <rect x="18.5" y="11" width="4" height="2" fill="#ffffff" />
    <rect x="1.5" y="11" width="4" height="2" fill="#ffffff" />
    <rect x="16.7" y="4.1" width="2" height="4" transform="rotate(45 16.7 4.1)" fill="#ffffff" />
    <rect x="4.2" y="16.6" width="2" height="4" transform="rotate(45 4.2 16.6)" fill="#ffffff" />
    <rect x="16.6" y="17.8" width="2" height="4" transform="rotate(135 16.6 17.8)" fill="#ffffff" />
    <rect x="4.2" y="5.3" width="2" height="4" transform="rotate(135 4.2 5.3)" fill="#ffffff" />
    <circle cx="12" cy="12" r="5.2" fill="#ffffff" />
    <circle cx="12" cy="12" r="2.6" fill="#000000" />
  </svg>
);

export const ChromeUserIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
    <circle cx="12" cy="8" r="4" fill="#ffffff" />
    <path d="M3 21c0-4.4 3.8-7 9-7s9 2.6 9 7z" fill="#ffffff" />
  </svg>
);

export const ChromeMessageIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
    <path d="M3 7c0-1.7 1.3-3 3-3h12c1.7 0 3 1.3 3 3v7c0 1.7-1.3 3-3 3h-6l-5 4v-4H6c-1.7 0-3-1.3-3-3z" fill="#ffffff" />
  </svg>
);
