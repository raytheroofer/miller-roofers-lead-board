import Image from "next/image";

export function BrandMark({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Miller Roofing Solutions"
      width={937}
      height={937}
      priority
      className={className}
    />
  );
}
