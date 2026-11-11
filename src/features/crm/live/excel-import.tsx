"use client";

import { useRef, useState, type ReactNode } from "react";
import { FileDown, FileUp } from "lucide-react";
import type { CrmLane } from "@speego/shared";
import { InlineAlert } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { crmPath } from "./lane";

type ImportKind = "messages" | "potentials" | "quotes" | "contracts" | "data-lanh";

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errorCount: number;
  errors: { sheet: string; row: number; message: string }[];
};

const labels: Record<ImportKind, string> = {
  messages: "mess",
  potentials: "khách tiềm năng",
  quotes: "báo giá",
  contracts: "hợp đồng",
  "data-lanh": "khách hàng",
};

export function useExcelImport({
  kind,
  lane,
  allLanes = false,
  enabled,
  onDone,
}: {
  kind: ImportKind;
  lane: CrmLane;
  allLanes?: boolean;
  enabled: boolean;
  onDone: () => void;
}): { buttons: ReactNode; banner: ReactNode } {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [tone, setTone] = useState<"success" | "warning" | "danger">("success");
  if (!enabled) return { buttons: null, banner: null };

  const uploadPath = kind === "data-lanh" ? "/api/data-lanh/import" : allLanes ? `/api/crm/import/${kind}` : crmPath(`/api/crm/import/${kind}`, lane);
  const templatePath = kind === "data-lanh" ? "/api/data-lanh/export?template=1" : allLanes
    ? `/api/crm/import/${kind}/template`
    : crmPath(`/api/crm/import/${kind}/template`, lane);

  const download = () => {
    setMessage(undefined);
    void fetch(templatePath, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Không tải được mẫu");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `mau-${labels[kind]}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        setTone("danger");
        setMessage("Không tải được mẫu Excel");
      });
  };

  const upload = (file: File | undefined) => {
    if (!file) return;
    setPending(true);
    setMessage(undefined);
    void file.arrayBuffer()
      .then((body) => api<ImportResult>(uploadPath, {
        method: "POST",
        body,
        headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      }))
      .then((result) => {
        const summary = `Đã thêm ${result.created}, cập nhật ${result.updated}, bỏ qua ${result.skipped}.`;
        const details = result.errors.map((issue) => `Dòng ${issue.row}: ${issue.message}`).join(" ");
        const more = result.errorCount > result.errors.length ? ` Còn ${result.errorCount - result.errors.length} lỗi khác.` : "";
        setTone(result.errorCount > 0 ? "warning" : "success");
        setMessage(result.errorCount > 0 ? `${summary} Lỗi ${result.errorCount}. ${details}${more}` : summary);
        onDone();
      })
      .catch((error: unknown) => {
        setTone("danger");
        setMessage(error instanceof ApiError ? error.message : "Không import được file");
        if (kind === "data-lanh") onDone();
      })
      .finally(() => {
        setPending(false);
        if (input.current) input.current.value = "";
      });
  };

  return {
    buttons: (
      <>
        <Button type="button" variant="outline" disabled={pending} onClick={download}><FileDown /> Tải mẫu</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => input.current?.click()}><FileUp /> Import Excel</Button>
        <input
          ref={input}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(event) => upload(event.target.files?.[0])}
        />
      </>
    ),
    banner: message ? <InlineAlert tone={tone} className="mb-4">{message}</InlineAlert> : null,
  };
}
