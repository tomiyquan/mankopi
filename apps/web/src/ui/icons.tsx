import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Svg(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props} />;
}

export const Icons = {
  home: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </Svg>
  ),
  building: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 21h16M6 21V7l6-3 6 3v14M10 11h.01M14 11h.01M10 15h.01M14 15h.01" />
    </Svg>
  ),
  pin: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </Svg>
  ),
  users: (p: IconProps) => (
    <Svg {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  ),
  shield: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3 5 6v6c0 4.2 2.7 7.9 7 9 4.3-1.1 7-4.8 7-9V6z" />
    </Svg>
  ),
  pulse: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </Svg>
  ),
  menu: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  ),
  close: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  ),
  logout: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </Svg>
  ),
  spark: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3v4M12 17v4M4.9 6.5l2.8 2.8M16.3 14.7l2.8 2.8M3 12h4M17 12h4M4.9 17.5l2.8-2.8M16.3 9.3l2.8-2.8" />
    </Svg>
  ),
  book: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 0-2 2zM8 7h6M8 11h6" />
    </Svg>
  ),
  journal: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 0-2 2V6a2 2 0 0 1 2-2zM6 8h14" />
    </Svg>
  ),
  calendar: (p: IconProps) => (
    <Svg {...p}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </Svg>
  ),
  chart: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 19h16M7 16V10M12 16V7M17 16v-4" />
    </Svg>
  ),
  tag: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3H4v8l9.4 9.4a2 2 0 0 0 2.8 0l5.2-5.2a2 2 0 0 0 0-2.8L12 3z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </Svg>
  ),
  sliders: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 7h16M4 17h16M8 4v6M16 14v6" />
    </Svg>
  ),
  eye: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="2.6" />
    </Svg>
  ),
  eyeOff: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 3l18 18" />
      <path d="M10.7 10.7A2.6 2.6 0 0 0 12 14.6a2.6 2.6 0 0 0 2.5-1.9" />
      <path d="M9.9 5.2A11 11 0 0 1 12 5c6.4 0 10 7 10 7a16.6 16.6 0 0 1-3.6 4.3" />
      <path d="M6.1 6.2C3.8 7.8 2 12 2 12s3.6 7 10 7c1.3 0 2.5-.2 3.6-.6" />
    </Svg>
  ),
};
