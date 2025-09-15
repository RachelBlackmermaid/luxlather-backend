# 🧼 LuxLather – Backend (Node.js)

Express.js REST API for LuxLather — an eCommerce app for liquid soaps and scented oils.

**Features**
- 👤 Admin auth with JWT
- 📦 Products, Categories, Orders (CRUD)
- 🖼 Optional image upload (e.g., Cloudinary)
- 🧪 Seed script for demo data
- ⚙️ Simple JavaScript stack (no Docker)

---

## 🛠 Tech Stack

- Node.js · Express.js
- (DB) MongoDB + Mongoose  _or_ your chosen DB (see `/db` folder)
- JSON Web Tokens (JWT)
- Cloudinary (optional uploads)

> If you’re using a different DB, adjust the `.env.example` & `/db` code accordingly.

---

## 🚀 Getting Started

### 1) Install deps
```bash
npm install
```
# 2. Configure environment
```bash
cp .env.example.env
```
# 3. Start the API
```bash
# dev (with nodemon, if configured)
npm run dev

# or plain start
npm start
```
Server runs at: http://localhost:${PORT} (default 8000)
# 📚 Common Scripts (package.json)
```bash
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "seed": "node seed.js",
    "lint": "eslint ."
  }
}
```
# 🔌 Example Endpoints
```bash
GET    /api/health
POST   /api/auth/login
POST   /api/auth/register

GET    /api/products
POST   /api/products        (auth)
PUT    /api/products/:id    (auth)
DELETE /api/products/:id    (auth)

GET    /api/categories
POST   /api/categories      (auth)

POST   /api/orders          (checkout)
GET    /api/orders          (auth)
```
# 🗂 Project Structure
```bash
server/
├─ controllers/     # request handlers
├─ db/              # DB connection & init
├─ models/          # Mongoose schemas (or your ORM models)
├─ routes/          # route definitions
├─ services/        # business logic
├─ utils/           # helpers (auth, error, etc.)
├─ seed.js          # demo data loader
├─ server.js        # app bootstrap
└─ .env.example     # template env (no secrets)
```
# ✅ Production Notes
- Rotate JWT_SECRET periodically
- Use indexes on frequent queries (MongoDB)
- Add rate limiting / CORS as needed
