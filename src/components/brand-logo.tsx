import Image from "next/image";

export function BrandLogo() {
  return (
    <span className="relative block h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-white sm:h-20 sm:w-28">
      <Image src="/brand/mrs-logo.png" alt="Miller Roofing Solutions crown and roof logo"
        width={640} height={851} loading="eager" unoptimized
        className="absolute left-1/2 top-1/2 w-[104px] max-w-none -translate-x-1/2 -translate-y-1/2 sm:w-[132px]" />
    </span>
  );
}
