export const BRAND_LOGO_SRC = "/logo/mankopi.png";

const sizes = {
  sm: "h-11 w-auto object-contain",
  md: "h-14 w-auto object-contain",
  lg: "h-[5.5rem] w-auto object-contain",
  hero: "h-28 w-auto object-contain",
  badge: "h-16 w-16 object-cover",
  compact: "h-11 w-11 object-cover",
} as const;

export function BrandLogo({
  size = "md",
  className,
  alt = "Mankopi",
  framed = true,
}: {
  size?: keyof typeof sizes;
  className?: string;
  alt?: string;
  framed?: boolean;
}) {
  const classes = [sizes[size], framed ? "rounded-2xl bg-black" : null, className].filter(Boolean).join(" ");
  return <img src={BRAND_LOGO_SRC} alt={alt} className={classes} />;
}
