# Chatty: real-time chat with a security focus

A full-stack one-to-one chat app built with React, Node.js, Socket.IO and MongoDB. It started as my final project for the 5-unit high-school cyber track ("Cyber Defense Systems", Israeli Ministry of Education), so most of the work went into the security layer: authentication, abuse protection, input sanitization and encryption of stored messages.

<!-- Add a screenshot here, e.g.: ![Chatty](docs/screenshot.png) -->

## Features

**Messaging**
- One-to-one real-time chat over Socket.IO
- Online presence and a typing indicator (clears itself after 3 seconds of silence)
- Image messages and profile pictures, uploaded to Cloudinary
- 32 DaisyUI themes; the chosen theme is remembered in the browser

**Security**
- Passwords hashed with bcrypt, with a strong-password rule at sign-up
- Account locked for 10 minutes after 5 failed login attempts in a row
- Session JWT stored in an `httpOnly`, `SameSite=strict` cookie (7-day expiry)
- Rate limiting on the API (general traffic, login, sending messages, key exchange) and on Socket.IO events
- Helmet security headers with a Content Security Policy
- XSS sanitization of request bodies and rejection of NoSQL operator injection (keys starting with `$` or containing `.`)
- Message text encrypted at rest in MongoDB with AES-256-GCM (random IV per message, auth tag verified on read)
- ECDH (P-256) key exchange between the two browsers using the Web Crypto API, relayed over Socket.IO

### How encryption works today

The server encrypts each message before storing it, so the database holds only ciphertext. The two browsers also run an ECDH key exchange and each derive the same per-conversation AES key, but that key is not yet used to encrypt message bodies. The server therefore can still read messages: this is **encryption at rest, not end-to-end encryption**.

**Next step:** wire the browser-side `encrypt` / `decrypt` helpers that already exist in `frontend/src/lib/crypto.js` into sending and loading messages, so the server only relays and stores ciphertext it cannot read.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 18, Vite, Zustand, React Router, Tailwind CSS + DaisyUI, Socket.IO client, Axios |
| Backend | Node.js, Express, Socket.IO, MongoDB + Mongoose, JWT, bcrypt, Helmet, express-rate-limit, Cloudinary |

## Project structure

```
backend/src/
  mainServer.js        Express app, middleware and routes
  endpoints/           Route definitions (auth, messages, key exchange)
  Handlers/            Request handlers
  secureAccess/        Rate limits, security headers, XSS/NoSQL filters, auth middleware
  lib/                 DB connection, Socket.IO server, encryption, Cloudinary
  schema/              Mongoose models (User, Message)
frontend/src/
  views/               Sign in, sign up, chat, profile, settings
  components/          Chat window, sidebar, input, typing indicator, loaders
  state/               Zustand stores (auth, chat, theme)
  lib/                 Axios instance, browser crypto (ECDH)
```

## Running locally

**Requirements:** Node.js 18+, a MongoDB database (local or Atlas), a Cloudinary account.

1. Clone the repo:
   ```bash
   git clone https://github.com/LiaMakmal1/chat-app.git
   cd chat-app
   ```
2. Create `backend/.env`:
   ```
   MONGODB_URI=mongodb://localhost:27017/chatty
   PORT=5001
   NODE_ENV=development
   JWT_SECRET=<random string>
   ENCRYPTION_SECRET=<64 hex characters>
   CLOUDINARY_CLOUD_NAME=<your cloud name>
   CLOUDINARY_API_KEY=<your api key>
   CLOUDINARY_API_SECRET=<your api secret>
   ```
   Generate the two secrets with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Without a fixed `ENCRYPTION_SECRET`, stored messages can't be decrypted after the server restarts.
3. Start the backend (http://localhost:5001):
   ```bash
   cd backend
   npm install
   npm run dev
   ```
4. In a second terminal, start the frontend (http://localhost:5173):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
5. Open the app in two different browsers (or one normal and one private window), sign up two users, and start chatting.
