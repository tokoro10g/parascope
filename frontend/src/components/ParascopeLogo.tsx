import type React from 'react';

interface ParascopeLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeColor?: string;
  fillColor?: string;
}

export const ParascopeLogo: React.FC<ParascopeLogoProps> = ({
  size = 100,
  strokeColor = 'currentColor',
  fillColor = 'currentColor',
  style,
  ...props
}) => {
  return (
    <svg
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={style}
      {...props}
    >
      <g fill="none" stroke={strokeColor} strokeWidth="6" strokeLinecap="butt">
        <rect x="10" y="10" width="80" height="80" rx="4" ry="4" />
        <line x1="50" y1="4" x2="50" y2="14" />
        <line x1="50" y1="86" x2="50" y2="96" />
        <line x1="4" y1="50" x2="14" y2="50" />
        <line x1="86" y1="50" x2="96" y2="50" />
      </g>
      <g
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="28" y1="32" x2="50" y2="50" />
        <line x1="28" y1="68" x2="50" y2="50" />
        <line x1="50" y1="50" x2="72" y2="50" />
        <circle cx="28" cy="32" r="5.5" stroke="none" />
        <circle cx="28" cy="68" r="5.5" stroke="none" />
        <circle cx="50" cy="50" r="5.5" stroke="none" />
        <circle cx="72" cy="50" r="5.5" stroke="none" />
      </g>
    </svg>
  );
};
