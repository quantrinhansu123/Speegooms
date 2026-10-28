"use client";

import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/shared/form-fields";
import { transportLabels } from "@/config/crm";
import type { NewRfqInput } from "../store";

const schema = z.object({
  goodsName: z.string().trim().min(2, "Nhập tên hàng hóa"),
  quantity: z.number({ error: "Nhập số lượng" }).positive("Số lượng phải lớn hơn 0"),
  unit: z.string().trim().min(1, "Nhập đơn vị"),
  originPoint: z.string().trim().min(2, "Nhập điểm đi"),
  destination: z.string().trim().min(2, "Nhập điểm đến"),
  transportMode: z.enum(["air", "sea-lcl", "sea-fcl"]),
  targetDate: z.string().min(1, "Chọn ngày cần hàng"),
  specialRequirements: z.string().trim(),
  sensitiveGoods: z.boolean(),
});

/**
 * Form yêu cầu báo giá. Trường lấy theo phiếu bàn giao trong tài liệu:
 * hàng hóa, số lượng, xuất xứ (do lead quyết định), điểm đi/đến, hạn, yêu cầu đặc biệt, hàng nhạy cảm.
 */
export function RfqForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
  disabled,
}: {
  defaultValues: NewRfqInput;
  submitLabel: string;
  onSubmit: (v: NewRfqInput) => void;
  onCancel?: () => void;
  disabled?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewRfqInput>({ resolver: zodResolver(schema), defaultValues });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Hàng hóa" htmlFor="rf-goods" required error={errors.goodsName?.message} className="sm:col-span-2">
        <Input id="rf-goods" disabled={disabled} {...register("goodsName")} aria-invalid={!!errors.goodsName} />
      </Field>
      <Field label="Số lượng" htmlFor="rf-qty" required error={errors.quantity?.message}>
        <Input id="rf-qty" type="number" min={0} disabled={disabled} {...register("quantity", { valueAsNumber: true })} aria-invalid={!!errors.quantity} />
      </Field>
      <Field label="Đơn vị" htmlFor="rf-unit" required error={errors.unit?.message}>
        <Input id="rf-unit" disabled={disabled} {...register("unit")} placeholder="cái, thùng, bộ, CBM…" />
      </Field>
      <Field label="Điểm đi" htmlFor="rf-from" required error={errors.originPoint?.message}>
        <Input id="rf-from" disabled={disabled} {...register("originPoint")} placeholder="Nơi lấy hàng / xưởng" />
      </Field>
      <Field label="Điểm đến" htmlFor="rf-to" required error={errors.destination?.message}>
        <Input id="rf-to" disabled={disabled} {...register("destination")} placeholder="Quốc gia, thành phố, ZIP" />
      </Field>
      <Field label="Hình thức vận chuyển" htmlFor="rf-mode">
        <NativeSelect id="rf-mode" disabled={disabled} {...register("transportMode")}>
          {(Object.keys(transportLabels) as (keyof typeof transportLabels)[]).map((m) => (
            <option key={m} value={m}>
              {transportLabels[m]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Ngày cần hàng" htmlFor="rf-date" required error={errors.targetDate?.message}>
        <Input id="rf-date" type="date" disabled={disabled} {...register("targetDate")} />
      </Field>
      <Field label="Yêu cầu đặc biệt" htmlFor="rf-special" className="sm:col-span-2">
        <Textarea id="rf-special" rows={2} disabled={disabled} {...register("specialRequirements")} />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" disabled={disabled} {...register("sensitiveGoods")} className="size-4 accent-[var(--brand-navy)]" />
        Hàng nhạy cảm / có nhãn hiệu (cần Ban GĐ và Pháp chế xác nhận, danh mục chưa có)
      </label>
      {!disabled && (
        <div className="flex justify-end gap-2 sm:col-span-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              <X /> Hủy
            </Button>
          )}
          <Button type="submit">{submitLabel}</Button>
        </div>
      )}
    </form>
  );
}
