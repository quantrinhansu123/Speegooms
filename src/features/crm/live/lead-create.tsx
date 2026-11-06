"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { convertMessageSchema, createMessageSchema, orderHasContent, type CrmLane } from "@speego/shared";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, api } from "@/lib/api";
import { crmPath } from "./lane";
import { useMessConvert, type Details } from "./mess-convert";
import { emptyDraft, marketPresets, MessFormDialog, todayInput, type MessDraft } from "./mess-form";
import type { MessageRecord } from "./types";

const marketOptions = marketPresets.map((market) => [market, market] as const);

/**
 * Nút "Tạo khách tiềm năng": nhập form y như Tạo mess (không có Link mess, nguồn lưu là "Khác") rồi tự chuyển
 * mess đó thành khách tiềm năng cùng thông tin đơn hàng bắt buộc. Loại khách theo Nhu cầu: Tìm hàng là Sourcing,
 * Vận chuyển là thuần Logistics, đúng như khi bấm Chuyển ở Mess.
 * Chỉ hiện cho vai trò được chuyển mess (admin, sale-vn, sale-global).
 */
export function LeadCreate({
  lane,
  error,
  setError,
  setNotice,
  onDone,
}: {
  lane: CrmLane;
  error?: string;
  setError: (message: string | undefined) => void;
  setNotice: (message: string | undefined) => void;
  onDone: () => void;
}) {
  const user = useSession();
  const [draft, setDraft] = useState<MessDraft | null>(null);
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const convert = useMessConvert({ lane, load: onDone, error, setError, setNotice });

  const open = () => {
    setFormError(undefined);
    setError(undefined);
    setNotice(undefined);
    setDraft({ ...emptyDraft, receivedOn: todayInput(), saleName: user.name });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.demand) {
      setFormError("Chọn Nhu cầu: Tìm hàng (khách Sourcing) hoặc Vận chuyển (khách thuần Logistics)");
      return;
    }
    if (!draft.order || !orderHasContent(draft.order)) {
      setFormError("Nhập thông tin sản phẩm: khách tiềm năng bắt buộc có đơn hàng");
      return;
    }
    if (draft.demand === "SHIPPING" && (!draft.shippingMode || (draft.shippingMode === "SEA" && !draft.logisticsClass))) {
      setFormError("Chọn đường bay hoặc đường biển và loại LCL/FCL nếu đi biển");
      return;
    }
    const details: Details = {
      phone: draft.phone, brand: draft.brand, customerType: draft.customerType,
      careChannel: draft.careChannel, productInterest: draft.goods,
      quantityNote: draft.quantityNote, address: draft.address, saleNote: draft.note,
      requirements: [draft.goods, draft.painPoint, draft.note].filter(Boolean).join("\n\n"),
      packageDimensions: draft.packageDimensions, weightKg: draft.weightKg,
      shipToAddress: draft.shipToAddress, reason: draft.convertReason,
    };
    const conversion = convertMessageSchema.safeParse({
      ...details,
      shippingMode: draft.demand === "SHIPPING" ? draft.shippingMode : undefined,
      logisticsClass: draft.demand === "SHIPPING" && draft.shippingMode === "SEA" ? draft.logisticsClass : undefined,
    });
    if (!conversion.success) {
      setFormError(conversion.error.issues[0]?.message ?? "Thông tin khách tiềm năng chưa đầy đủ");
      return;
    }
    const parsed = createMessageSchema.safeParse({
      ...draft,
      saleName: user.name,
      linkMess: "",
      source: "OTHER",
      receivedOn: draft.receivedOn || undefined,
      industry: draft.industry || undefined,
      customerType: draft.customerType || undefined,
      classification: draft.classification || undefined,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }
    setPending(true);
    setFormError(undefined);
    let created: MessageRecord;
    try {
      created = (await api<{ message: MessageRecord }>(crmPath("/api/crm/messages", lane), { method: "POST", body: JSON.stringify(parsed.data) })).message;
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : "Không tạo được khách hàng tiềm năng");
      setPending(false);
      return;
    }
    const { shippingMode, logisticsClass } = draft;
    setDraft(null);
    setPending(false);
    // Mess đã lưu: nếu bước chuyển lỗi, mess vẫn nằm ở trang Mess để Sale bấm Chuyển lại.
    await convert.convertWith(created, shippingMode, logisticsClass, "", details);
    onDone();
  };

  return (
    <>
      <Button onClick={open}><Plus /> Tạo khách tiềm năng</Button>
      <MessFormDialog
        draft={draft}
        setDraft={setDraft}
        title="Tạo khách hàng tiềm năng"
        submitLabel="Tạo"
        formError={formError}
        pending={pending}
        onSave={() => void save()}
        onClose={() => { if (!pending) setDraft(null); }}
        marketOptions={marketOptions}
        goodsOptions={[]}
        canConvert
        lead
      />
      {convert.dialogs}
    </>
  );
}
