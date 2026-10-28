import { Fragment } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

/** Giữ nguyên nội dung chữ cho trình đọc màn hình và dữ liệu xuất CSV. */
export function ArrowText({ children }: { children: string }) {
  return children.split(/([→←])/).map((part, index) => {
    if (part !== "→" && part !== "←") return part;
    const Icon = part === "→" ? ArrowRight : ArrowLeft;
    return (
      <Fragment key={index}>
        <Icon aria-hidden className="mx-1 inline-block size-[1em] align-[-0.125em]" />
        <span className="sr-only">{part}</span>
      </Fragment>
    );
  });
}
