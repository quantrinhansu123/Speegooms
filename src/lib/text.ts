/** Chuẩn hóa để tìm kiếm không phân biệt hoa thường và dấu tiếng Việt. */
export const normalizeText = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");

export const matchesQuery = (query: string, ...fields: (string | undefined)[]) => {
  const q = normalizeText(query.trim());
  return !q || fields.some((f) => f && normalizeText(f).includes(q));
};
