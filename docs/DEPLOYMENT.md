# Deployment Guide: Multi-Tenant Event & Ticket Reservation System

This guide explains how to deploy the system to **Render**, **Railway**, and **Vercel**, including PostgreSQL and Redis configuration.

---

## 1. Cloud Architecture Overview

| Component | Recommended Host | Production Setup | Free Tier Compatibility |
|---|---|---|---|
| **API Backend & Cron Worker** | [Render.com](https://render.com) or [Railway.app](https://railway.app) | Node.js Web Service (`node src/server.js`) | Yes (Free Web Service) |
| **Frontend Application** | [Vercel](https://vercel.com) or [Render Static Site](https://render.com) | Vite React SPA Build (`npm run build`) | Yes (Unlimited Free) |
| **Database** | Render PostgreSQL, Neon.tech, or Supabase | PostgreSQL connection string (`DATABASE_URL`) | Yes (Free tier) |
| **Cache & Distributed Lock** | [Upstash Redis](https://upstash.com) or Redis Cloud | Redis connection URL (`REDIS_URL`) | Yes (Free 10,000 commands/day) |

---

## 2. Deploy Backend to Render (Step-by-Step)

### Step 2.1: Create a PostgreSQL Database on Render (or Neon)
1. In the Render Dashboard, click **New +** -> **PostgreSQL**.
2. Name: `event-reservation-db`.
3. Plan: **Free**.
4. Click **Create Database**.
5. Once created, copy the **Internal Database URL** (or External Database URL if deploying elsewhere).

### Step 2.2: Create Free Redis on Upstash
1. Go to [Upstash.com](https://console.upstash.com) and create a free Redis database.
2. Select **Global** or region nearest to your Render service.
3. Under **Connect to your database**, copy the **Node.js (ioredis)** connection URL:
   `rediss://default:xxxx@xxxx.upstash.io:6379`

### Step 2.3: Create Web Service on Render
1. Click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. Configure the service:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. In **Environment Variables**, add:
   ```env
   NODE_ENV=production
   PORT=10000
   JWT_SECRET=super_secure_jwt_secret_render_production_key_2026
   DATABASE_URL=postgres://user:password@hostname:5432/event_reservation_db
   REDIS_URL=rediss://default:xxxx@xxxx.upstash.io:6379
   ```
5. Click **Create Web Service**.
   Render will deploy your API, auto-create database tables, and start the background hold-expiration worker.
6. Note down your backend URL (e.g., `https://event-reservation-backend.onrender.com`).

---

## 3. Deploy Frontend to Vercel

1. Log in to [Vercel](https://vercel.com) and click **Add New** -> **Project**.
2. Select your GitHub repository.
3. In **Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. In **Environment Variables**, add:
   ```env
   VITE_API_URL=https://event-reservation-backend.onrender.com/api
   ```
5. Click **Deploy**.
   Vercel will build and assign a production URL (e.g., `https://event-reservation-frontend.vercel.app`).

---

## 4. Alternative: Deploy Backend & Frontend on Railway

1. Install Railway CLI or connect via [Railway.app](https://railway.app).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Add **PostgreSQL** plugin and **Redis** plugin from the Railway template marketplace.
4. Railway will automatically link `DATABASE_URL` and `REDIS_URL` to your service.
5. In your Railway service settings:
   - **Build Command**: `npm install --prefix backend`
   - **Start Command**: `npm run start --prefix backend`
6. Click **Generate Domain**.

---

## 5. Local Development Execution (Zero Setup)

Thanks to the dual-engine architecture, running locally requires zero external database installation:
- SQLite runs via WebAssembly (`sql.js`) with automatic disk persistence in `backend/data/reservations.sqlite`.
- Redis operates with a high-performance in-memory cache and atomic locking engine if `REDIS_URL` is omitted.

### Quickstart Command:
```bash
# Clone the repository
git clone <repo-url>
cd "WT assignment"

# Install dependencies (root, backend, frontend)
npm install
npm install --prefix backend
npm install --prefix frontend

# Seed sample events, organizers, tiers, and orders
npm run seed

# Run concurrent bookings stress test
npm run test:concurrency

# Start both Backend (Port 5000) and Frontend (Port 5173) simultaneously
npm run dev
```

Visit:
- **Web Application UI**: `http://localhost:5173`
- **REST API Backend**: `http://localhost:5000/api`
- **Health Check**: `http://localhost:5000/api/health`
