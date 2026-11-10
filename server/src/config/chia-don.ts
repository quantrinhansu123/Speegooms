/** Người kế tiếp theo vòng tròn: lần lượt sau người được chia gần nhất, bỏ qua người đang off. Không còn ai nhận được thì null. */
export function pickNextAssignee(order: readonly string[], available: ReadonlySet<string>, lastId: string | null): string | null {
  if (order.length === 0) return null;
  const start = lastId ? order.indexOf(lastId) + 1 : 0; // lastId không còn trong danh sách -> bắt đầu từ đầu
  for (let step = 0; step < order.length; step += 1) {
    const id = order[(start + step) % order.length]!;
    if (available.has(id)) return id;
  }
  return null;
}
