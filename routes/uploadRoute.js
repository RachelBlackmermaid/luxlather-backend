import express from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../utils/cloudinary.js";

const router = express.Router();

// Configure storage 
const storage = new CloudinaryStorage({
    cloudinary, 
    folder:"luxlather",
    params: {
        allowed_formats: ["jpg", "png", "jpeg", "webp", "svg"],
    },
});

const upload = multer({storage});

//POST /api/upload
router.post("/", upload.single("image"), (req, res) => {
  console.log("REQ.FILE:", req.file);

  if (!req.file || !req.file.path) {
    console.error("❌ Upload failed: no file");
    return res.status(400).json({ error: "No file uploaded or upload failed" });
  }

  res.json({ imageUrl: req.file.path });
});

  

export default router;
