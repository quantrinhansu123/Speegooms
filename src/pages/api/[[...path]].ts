import type { NextApiRequest, NextApiResponse } from "next";
import { getApp } from "../../../server/src/runtime";

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

/** Express chạy trong cùng function với Next. Không cần process cổng 4000. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const app = await getApp();
  await new Promise<void>((resolve, reject) => {
    res.once("finish", () => resolve());
    res.once("error", reject);
    app(req as never, res as never);
  });
}
