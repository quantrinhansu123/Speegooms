"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Unlink, UserCheck, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { activeSources, originLabels, sourceLabels } from "@/config/crm";
import { findDuplicatesFor, routeFromOrigin, staffOfRoute } from "@/services/crm/rules";
import { useCrm } from "../hooks";

const schema = z.object({
  contactName: z.string().trim().min(2, "Nhập tên khách (tối thiểu 2 ký tự)"),
  company: z.string().trim(),
  phone: z.string().trim().regex(/^[0-9+()\s.-]{8,}$/, "Số điện thoại không hợp lệ"),
  email: z.string().trim().refine((v) => v === "" || /^\S+@\S+\.\S+$/.test(v), "Email không đúng định dạng"),
  source: z.enum(["ads", "google", "organic"]),
  goodsOrigin: z.enum(["vn", "cn", "unknown"]),
  ownerId: z.string().min(1, "Chọn người phụ trách"),
  needSummary: z.string().trim(),
});
type FormValues = z.infer<typeof schema>;

export function LeadFormDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (messId: string) => void }) {
  const { all, actions, scope, user } = useCrm();
  const [customerId, setCustomerId] = useState<string>();
  const [error, setError] = useState<string>();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      contactName: "",
      company: "",
      phone: "",
      email: "",
      source: "ads",
      goodsOrigin: scope === "global" ? "cn" : scope === "vn" ? "vn" : "unknown",
      ownerId: all.staff.some((s) => s.id === user.id) ? user.id : "",
      needSummary: "",
    },
  });

  const [phone, email, company, origin] = useWatch({ control, name: ["phone", "email", "company", "goodsOrigin"] });
  const duplicates = useMemo(
    () => (customerId ? [] : findDuplicatesFor(all.customers, { phone, email, name: company })),
    [all.customers, phone, email, company, customerId],
  );
  const route = routeFromOrigin(origin);
  const owners = route ? staffOfRoute(all.staff, route) : all.staff.filter((s) => s.team === "sale-vn" || s.team === "sale-global");
  const linked = all.customers.find((c) => c.customerId === customerId);

  const close = (o: boolean) => {
    if (!o) {
      reset();
      setCustomerId(undefined);
      setError(undefined);
    }
    onOpenChange(o);
  };

  const onSubmit = (v: FormValues) => {
    const res = actions.createLead({ ...v, customerId });
    if (res.ok && res.id) {
      close(false);
      onCreated(res.id);
    } else if (!res.ok) setError(res.error);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tạo lead mới</DialogTitle>
          <DialogDescription>Chỉ cần ngày và tên khách là đủ để cấp mess_id. Các thông tin khác bổ sung sau khi trao đổi.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên khách" htmlFor="lf-name" required error={errors.contactName?.message}>
            <Input id="lf-name" {...register("contactName")} aria-invalid={!!errors.contactName} />
          </Field>
          <Field label="Công ty" htmlFor="lf-company">
            <Input id="lf-company" {...register("company")} />
          </Field>
          <Field label="Số điện thoại" htmlFor="lf-phone" required error={errors.phone?.message}>
            <Input id="lf-phone" type="tel" {...register("phone")} aria-invalid={!!errors.phone} />
          </Field>
          <Field label="Email" htmlFor="lf-email" error={errors.email?.message}>
            <Input id="lf-email" type="email" {...register("email")} aria-invalid={!!errors.email} />
          </Field>

          {(duplicates.length > 0 || linked) && (
            <div className="sm:col-span-2">
              {linked ? (
                <InlineAlert tone="info" className="flex items-center justify-between gap-3">
                  <span>
                    Lead sẽ gắn với khách có sẵn <strong>{linked.customerId}</strong> · {linked.name}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCustomerId(undefined)}>
                    <Unlink /> Bỏ gắn
                  </Button>
                </InlineAlert>
              ) : (
                <InlineAlert tone="warning">
                  <p className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle aria-hidden className="size-4" /> Có thể trùng khách hàng đã có (cảnh báo demo)
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {duplicates.map((c) => (
                      <li key={c.customerId} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate">
                          {c.customerId} · {c.name} · {c.phone}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCustomerId(c.customerId);
                            setValue("company", c.name);
                          }}
                        >
                          <UserCheck /> Dùng khách này
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">Bỏ qua cảnh báo để tạo khách mới nếu đây là người khác.</p>
                </InlineAlert>
              )}
            </div>
          )}

          <Field label="Nguồn lead" htmlFor="lf-source" hint="Affiliate chưa kích hoạt nên chưa chọn được.">
            <NativeSelect id="lf-source" {...register("source")}>
              {activeSources.map((s) => (
                <option key={s} value={s}>
                  {sourceLabels[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Xuất xứ hàng" htmlFor="lf-origin" hint={route ? `Phân về ${route === "vn" ? "Sale Việt Nam" : "Sale Global"}` : "Chưa rõ: cần xác định trước khi tạo RFQ"}>
            <NativeSelect
              id="lf-origin"
              {...register("goodsOrigin", {
                onChange: () => setValue("ownerId", ""),
              })}
            >
              {(Object.keys(originLabels) as (keyof typeof originLabels)[]).map((o) => (
                <option key={o} value={o}>
                  {originLabels[o]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Người phụ trách" htmlFor="lf-owner" required error={errors.ownerId?.message}>
            <NativeSelect id="lf-owner" {...register("ownerId")}>
              <option value="">Chọn nhân viên</option>
              {owners.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Nhu cầu tóm tắt" htmlFor="lf-need">
            <Input id="lf-need" {...register("needSummary")} placeholder="Khách cần gì" />
          </Field>

          {error && <InlineAlert className="sm:col-span-2">{error}</InlineAlert>}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              <X /> Hủy
            </Button>
            <Button type="submit"><Save aria-hidden /> Tạo mới</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
