declare const sqlBrand: unique symbol;

/** Biểu thức cột do mã nguồn khai báo, không nhận từ người dùng. */
export type SqlExpression = string & { readonly [sqlBrand]: true };

export function sql(expression: string): SqlExpression {
  if (!/^[A-Za-z0-9_.'():> -]+$/.test(expression)) {
    throw new Error("Biểu thức cột không hợp lệ");
  }
  return expression as SqlExpression;
}
