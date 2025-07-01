import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;


router.post("/login", (req,res) => {
    const {username, password} = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ role: "admin"}, process.env.JWT_SECRET, {
            expiresIn: "1d",
        });
        return res.json({ token });
    }

    res.status(401).json({  error: "Invalid credentials"});
  
});

export default router;