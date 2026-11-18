const words = (name: string) => name.normalize("NFC").trim().toLowerCase().split(/\s+/).filter(Boolean);
const contains = (full: string[], part: string[]) => part.length > 0 && full.some((_, start) => part.every((word, offset) => full[start + offset] === word));

/**
 * Bộ lọc nhân viên sale: mỗi người một họ tên đầy đủ.
 * Mess lưu tên gõ tay ("Hân", "Quyên"...), nên tên nào nằm trọn trong đúng một họ tên đầy đủ thì gộp vào người đó.
 * otherStaff: sale tuyến khác, chỉ dùng để nhận ra tên gõ tắt của họ.
 * Tên mơ hồ (khớp nhiều người) hoặc không khớp ai (ví dụ admin) giữ nguyên thành một lựa chọn riêng.
 * value là các dạng tên của người đó ngăn cách bằng "|" để server lọc đủ mọi dạng.
 */
export function saleFilterOptions(staff: readonly string[], stored: readonly string[], otherStaff: readonly string[] = []): { label: string; value: string }[] {
  const people = [...new Map([...staff, ...otherStaff].map((name) => [words(name).join(" "), name.trim()] as const)).values()];
  const aliases = new Map(people.map((name) => [name, [name]]));
  const leftovers: string[] = [];
  for (const raw of stored) {
    const value = raw.trim();
    if (!value) continue;
    const matches = people.filter((name) => contains(words(name), words(value)));
    if (matches.length === 1) {
      const list = aliases.get(matches[0])!;
      if (!list.some((item) => item.toLowerCase() === value.toLowerCase())) list.push(value);
    } else if (!leftovers.some((item) => item.toLowerCase() === value.toLowerCase())) leftovers.push(value);
  }
  // Sale tuyến khác chỉ hiện khi mess tuyến này có ghi tên họ.
  const shown = people.filter((name) => staff.includes(name) || aliases.get(name)!.length > 1);
  return [
    ...shown.map((name) => ({ label: name, value: aliases.get(name)!.join("|") })),
    ...leftovers.map((name) => ({ label: name, value: name })),
  ].sort((a, b) => a.label.localeCompare(b.label, "vi"));
}
