# Two Truth One Lie Game

Game multiplayer "Two Truth One Lie" dengan real-time socket.io

## 🚀 Deployment

### Frontend (Vercel)
1. Fork/clone repo ini
2. Connect ke Vercel
3. Set environment variables:
   - `VITE_BACKEND_URL`: URL backend Railway

### Backend (Railway)
1. Connect repo ke Railway
2. Deploy dari folder `backend`
3. Set environment variables:
   - `PORT`: 3001
   - `FRONTEND_URL`: URL frontend Vercel

### GitHub Secrets
Tambahkan secrets berikut di GitHub repo settings:

**Vercel:**
- `VERCEL_TOKEN`: Token dari Vercel dashboard
- `VERCEL_ORG_ID`: Organization ID
- `VERCEL_PROJECT_ID`: Project ID

**Railway:**
- `RAILWAY_TOKEN`: Token dari Railway dashboard
- `RAILWAY_SERVICE`: Service name

## 🎮 Cara Main
1. Masukkan nickname
2. Buat room atau join room
3. Minimal 2 pemain untuk mulai
4. Tulis 2 kebenaran dan 1 kebohongan
5. Tebak kebohongan pemain lain
6. Dapatkan poin tertinggi!

## 🛠️ Development
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend  
cd frontend
npm install
npm start
```