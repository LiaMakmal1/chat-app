# Chatty – Real-Time Encrypted Chat App

**Chatty** is a modern, secure real-time chat application built with **React**, **Node.js**, and **Socket.IO**. It features full end-to-end encryption, sleek responsive UI, and powerful real-time communication tools.

---

## ✨ Key Features

### 🔐 Security & Privacy
- **End-to-End Encryption** using Diffie-Hellman + AES-256-GCM
- **Automatic Key Exchange** at the start of every conversation
- **Server-side Encryption Fallback** for legacy compatibility
- **Secure JWT Authentication** (via HTTP-only cookies)
- **Rate Limiting** to prevent abuse
- **Input Sanitization** (XSS and NoSQL injection protection)

### 💬 Real-Time Messaging
- Instant messaging with **Socket.IO**
- Typing indicators and online presence tracking
- Image upload and sharing via **Cloudinary**
- Persistent message history per user

### 🎨 User Experience
- Over **30+ DaisyUI themes**
- **Responsive** design for mobile & desktop
- Modern UI with smooth animations and skeleton loaders
- Avatar uploads and profile customization

### 🛠 Technical Stack
- Node.js backend with clustering for **multi-threaded performance**
- React + Zustand frontend with **Vite hot-reloading**
- Full error handling and developer tooling
- Modular folder structure for clean separation of concerns

---

## 🚀 Quick Start

### Prerequisites
- Node.js `v16+`
- MongoDB `4.4+`
- Cloudinary account (for image uploads)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/chatty.git
cd chatty

# Install backend
cd backend
npm install

# Install frontend
cd ../frontend
npm install
