"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { formatMoney } from "@/lib/format";
import type { Contract, DepositChannel } from "@/types/crm";
import { useCrm } from "../hooks";

/** Sale gửi yêu cầu để Kế toán đối soát và xác nhận "Đã cọc". Sale không tự xác nhận. */
export function DepositRequestDialog({ contract, open, onOpenChange }: { contract: Contract; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { actions } = useCrm();
  const [amount, setAmount] = useState(contract.deposit.amount);
  const [channel, setChannel] = useState<DepositChannel>("tai-khoan-cong-ty");
  const [billRef, setBillRef] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();

  const submit = () => {
    const res = actions.requestDeposit(contract.orderId, { amount, channel, billRef, note });
    if (res.ok) onOpenChange(false);
    else setError(res.error);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yêu cầu Kế toán xác nhận cọc</DialogTitle>
          <DialogDescription>
            Hợp đồng {contract.contractNo} · giá trị {formatMoney(contract.value, contract.currency)}. Gửi bill để Kế toán đối soát; chưa xác nhận thì chưa đặt xưởng.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Số tiền cọc" htmlFor="dp-amount" required hint="Gợi ý theo tỷ lệ cọc mô phỏng, Sale chỉnh theo hợp đồng thực tế.">
            <Input id="dp-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Field label="Kênh nhận tiền" htmlFor="dp-channel">
            <NativeSelect id="dp-channel" value={channel} onChange={(e) => setChannel(e.target.value as DepositChannel)}>
              <option value="tai-khoan-cong-ty">Tài khoản công ty</option>
              <option value="khac">Kênh khác (ngoại lệ)</option>
            </NativeSelect>
          </Field>
          {channel === "khac" && (
            <InlineAlert tone="warning" className="text-xs">
              Kênh ngoài tài khoản công ty là ngoại lệ cần phê duyệt. Quy trình ngoại lệ chưa được thiết kế (Kế toán và Pháp chế), yêu cầu vẫn được ghi nhận để Kế toán xem xét.
            </InlineAlert>
          )}
          <Field label="Mã / ảnh bill chuyển khoản" htmlFor="dp-bill" required>
            <Input id="dp-bill" value={billRef} onChange={(e) => setBillRef(e.target.value)} placeholder="Mã giao dịch hoặc tên file bill" />
          </Field>
          <Field label="Ghi chú cho Kế toán" htmlFor="dp-note">
            <Textarea id="dp-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {error && <InlineAlert>{error}</InlineAlert>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={submit}>Gửi yêu cầu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
