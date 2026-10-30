import type { Request, Response } from "express";
import { type CloudinaryConfig, uploadImage } from "../adapters/cloudinary/upload";

export class UploadController {
  constructor(private readonly cloudinary: CloudinaryConfig | undefined) {}

  createImage = async (req: Request, res: Response) => {
    const result = await uploadImage(this.cloudinary, String(req.body.image ?? ""));
    res.status(201).json({ url: result.url, publicId: result.publicId });
  };
}
