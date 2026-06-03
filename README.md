# Conekt Ads Internal Platform

Starter monorepo for the Conekt Ads Internal Platform.

This project is being built to replace scattered Excel sheets, WhatsApp threads, and email trails with one internal workflow:

Lead / Request -> Campaign -> Plan -> Share -> Won -> Operations -> Execution Report

This first version includes the project foundation, Google Workspace SSO, and simple user management. It does not include inventory CRUD, campaign logic, or deployment automation yet.

## Tech Stack

- Backend: Node.js, Express.js, MongoDB, Mongoose
- Frontend: React, Vite, Tailwind CSS
- Routing: React Router
- Future auth: Google Workspace SSO
- Future storage: S3 or compatible storage
- Future deployment: AWS / Docker

## Project Structure

```txt
client/
  React + Vite + Tailwind frontend

server/
  Node.js + Express backend
  route -> controller -> service -> repository -> model
```

## Backend Setup

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

The backend runs on `http://localhost:5000` by default.

Health check:

```bash
GET http://localhost:5000/api/health
```

## Frontend Setup

```bash
cd client
npm install
npm run dev
```

The frontend runs on the Vite URL shown in the terminal, usually `http://localhost:5173`.

## Environment Variables

Create `server/.env` from `server/.env.example`, or use `server/.env.local` for local development:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/conekt_ads_internal
CLIENT_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_ALLOWED_DOMAIN=conektads.com
GEOCODING_PROVIDER=nominatim
MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
JWT_SECRET=replace_this_secret
JWT_EXPIRES_IN=8h
COOKIE_NAME=conekt_ads_token
COOKIE_SECURE=true
```

The backend also accepts `MONGODB_URI` for local compatibility.

For local HTTP testing only, set `COOKIE_SECURE=false` in `server/.env.local` so the browser accepts the auth cookie.

The client also needs:

```env
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
```

## Auth Setup

Auth uses Google Workspace SSO and stores the app session as a JWT in an httpOnly cookie. Users must exist in the platform and be active before they can sign in.

Seed the first admin:

```bash
cd server
npm run seed:admin
```

Then log in from the frontend with:

```txt
admin@conektads.com
```

## What Exists Now

- Express server setup
- MongoDB connection helper
- CORS, JSON body parsing, dotenv config
- Basic error middleware
- Flat backend folders for routes, controllers, services, repositories, DTOs, and models
- Dependency injection with tsyringe
- Base repository and user repository
- `GET /api/health`
- Google auth route: `POST /api/auth/google`
- Auth routes: `POST /api/auth/logout`, `GET /api/auth/me`
- User management routes for admin/member access
- Inventory category summary and CRUD routes with filtering, auto-generated codes, confirmation, and admin-only activate/deactivate
- Reverse geocoding route for map-picked inventory locations
- React + Vite frontend shell
- Tailwind CSS setup
- TypeScript setup for both frontend and backend
- Sidebar, topbar, and main content layout
- Protected frontend routes
- Login page and Settings users section
- Inventory page with category cards, subcategory filters, table, code preview, Outdoor map picker, add/edit form, and confirmation modal
- Placeholder pages for the first internal modules

## What To Build Next

1. Define the first real workflow slice, likely Inventory or CRM.
2. Add Google Workspace SSO.
3. Add user roles and access rules.
4. Create the first MongoDB models only when the workflow is agreed.
5. Add API routes and frontend screens for the chosen first module.

## Production-style Backend Start

```bash
cd server
npm run build
npm start
```
