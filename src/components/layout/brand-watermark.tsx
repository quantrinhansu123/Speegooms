import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logo SpeeGo mờ chìm phía sau nội dung trang. */
export function BrandWatermark({
  className,
  imageClassName,
}: {
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}
      aria-hidden
    >
      <Image
        src="/logo.png"
        alt=""
        width={170}
        height={51}
        className={cn(
          "absolute top-[46%] left-1/2 w-[min(40rem,72%)] max-w-none -translate-x-1/2 -translate-y-1/2 -rotate-6 opacity-[0.06] mix-blend-multiply select-none",
          imageClassName,
        )}
      />
    </div>
  );
}
