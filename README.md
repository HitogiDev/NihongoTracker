# 🇯🇵 NihongoTracker

**Transform your Japanese immersion into a game**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.0+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-ISC-blue?style=for-the-badge)](LICENSE)
[![Patreon](https://img.shields.io/badge/Support-Patreon-FF424D?style=for-the-badge&logo=patreon&logoColor=white)](https://www.patreon.com/nihongotracker)

Track your anime, manga, visual novels, books, videos, movies, TV shows, and audio immersion. Earn XP, level up, maintain streaks, and compete on leaderboards while mastering Japanese.

[**Live Demo**](https://nihongotracker.com) · [**Report Bug**](https://github.com/HitogiDev/NihongoTracker/issues) · [**Request Feature**](https://github.com/HitogiDev/NihongoTracker/issues)

---

## 📑 Table of Contents

- [Screenshots](#-screenshots)
- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Docker Setup (Recommended)](#docker-setup-recommended)
  - [Manual Setup](#manual-setup-for-development)
  - [Environment Variables](#environment-variables)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [Support](#-support)
- [License](#-license)

---

## Screenshots

All screenshots below are in the dark theme.

### Dashboard

![Dashboard](./screenshots/dashboard.png)

*Main dashboard showing your recent activity, a feed and some useful stats*

### Log Tracking

![Log Tracking](./screenshots/log-tracking.png)

*Track your immersion across multiple media types with autocomplete*

### Stats

![Stats](./screenshots/user-stats.png)

*Detailed charts and stats of your immersion*

### Media Stats

![Media Stats](./screenshots/media-stats.png)

*Media-specific breakdowns and progress analytics*

### TextHooker

![TextHooker](./screenshots/texthooker.png)

*Texthooker to easily log your visual novel immersion with one click*

### Leaderboards

![Leaderboards](./screenshots/leaderboards.png)

*Compete with other immersion learners*

### Clubs

![Clubs](./screenshots/clubs.png)

*Join or create immersion clubs*

---

## Technology Stack

### Frontend

- **Framework:** React 19 + TypeScript 5
- **Routing:** React Router v6
- **State Management:** Zustand + TanStack Query
- **Styling:** Tailwind CSS v4 + DaisyUI v5
- **Charts:** Chart.js / Recharts
- **Realtime:** Socket.IO client + WebSocket text capture
- **Build Tool:** Vite

### Backend

- **Runtime:** Node.js 18+ (20+ recommended)
- **Framework:** Express.js + TypeScript
- **Database:** MongoDB + Mongoose
- **Authentication:** JWT + bcrypt
- **Realtime:** Socket.IO
- **Search:** Meilisearch
- **File Storage:** Firebase Storage
- **External APIs:** GraphQL (AniList), REST (VNDB, YouTube)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18 or higher (20+ recommended)
- **MongoDB** 6.0+ (local or Atlas)
- **Firebase** account (for file storage)
- **API Keys** (optional): AniList, VNDB, YouTube

### Docker Setup (Recommended)

The fastest way to get NihongoTracker running:

```bash
# Clone the repository
git clone https://github.com/HitogiDev/NihongoTracker.git
cd NihongoTracker

# Copy and configure environment variables
cp Backend/.env.example Backend/.env
# Edit Backend/.env with your configuration

# Build and start all services
docker compose up --build
```

The app will be available at `http://localhost:5173`

### Manual Setup (for Development)

#### Backend Setup

```bash
cd Backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings (see Environment Variables below)

# Start development server with hot reload
npm run dev
```

The API server runs on `http://localhost:3000` by default.

#### Frontend Setup

```bash
cd Frontend
npm install

# Start Vite dev server
npm run dev
```

The frontend runs on `http://localhost:5173` with HMR enabled.

#### Production Build

```bash
# Build frontend
cd Frontend
npm run build

# Build backend and copy frontend assets
cd ../Backend
npm run build:frontend  # Copies Frontend/dist to Backend/dist
npm run build           # Compile TypeScript

# Start production server
npm start
```

In production, Express serves both the API and static frontend from a single server.

### Environment Variables

Create a `Backend/.env` file with the following variables:

| Variable                        | Required | Description                                                           |
| ------------------------------- | -------- | --------------------------------------------------------------------- |
| `PORT`                          | No       | Server port (default: 3000)                                           |
| `NODE_ENV`                      | No       | `development` or `production`                                         |
| `TOKEN_SECRET`                  | **Yes**  | JWT signing secret (use a secure random string)                       |
| `DATABASE_URL`                  | **Yes**  | MongoDB connection string                                             |
| `PROD_DOMAIN`                   | No       | Production domain used for app links and metadata                     |
| `BACKEND_URL`                   | No       | Backend base URL (default local: `http://localhost:3000`)             |
| `FRONTEND_URL`                  | No       | Frontend base URL (default local: `http://localhost:5173`)            |
| `FIREBASE_API_KEY`              | **Yes**  | Firebase API key                                                      |
| `FIREBASE_AUTH_DOMAIN`          | **Yes**  | Firebase auth domain                                                  |
| `FIREBASE_PROJECT_ID`           | **Yes**  | Firebase project ID                                                   |
| `FIREBASE_STORAGE_BUCKET`       | **Yes**  | Firebase storage bucket                                               |
| `FIREBASE_MESSAGING_SENDER_ID`  | **Yes**  | Firebase messaging sender ID                                          |
| `FIREBASE_APP_ID`               | **Yes**  | Firebase app ID                                                       |
| `FIREBASE_MEASUREMENT_ID`       | No       | Firebase analytics measurement ID                                     |
| `YOUTUBE_API_KEY`               | No       | YouTube Data API key (for video metadata)                             |
| `JITEN_API_URL`                 | No       | Dictionary API URL used by text tooling                               |
| `MANABE_API_URL`                | No       | Manabe integration base URL                                           |
| `MANABE_WEBHOOK_TOKEN`          | No       | Shared token for Manabe webhook imports                               |
| `PATREON_CLIENT_ID`             | No       | Patreon OAuth client ID                                               |
| `PATREON_CLIENT_SECRET`         | No       | Patreon OAuth client secret                                           |
| `PATREON_WEBHOOK_SECRET`        | No       | Patreon webhook verification secret                                   |
| `PATREON_CREATOR_ACCESS_TOKEN`  | No       | Patreon creator access token                                          |
| `PATREON_CAMPAIGN_ID`           | No       | Patreon campaign ID                                                   |
| `MAILTRAP_TOKEN`                | No       | Mailtrap API token for transactional email                            |
| `MAILTRAP_INBOX_DOMAIN`         | No       | Mailtrap inbox domain                                                 |
| `MEILISEARCH_HOST`              | No       | Meilisearch host URL                                                  |
| `MEILISEARCH_API_KEY`           | No       | Meilisearch admin/search API key                                      |

**Example `.env` file:**

```env
PORT=3000
NODE_ENV=development
TOKEN_SECRET=your-super-secret-jwt-key-change-this
DATABASE_URL=mongodb://localhost:27017/nihongotracker
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173

# Firebase Configuration
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# Optional: External APIs
YOUTUBE_API_KEY=your-youtube-api-key

# Optional: Search
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=your-meilisearch-key
```

---

## 📖 API Reference

Base URL: `/api`

### Authentication API

| Method | Endpoint         | Description                  |
| ------ | ---------------- | ---------------------------- |
| `POST` | `/auth/register` | Create a new account         |
| `POST` | `/auth/login`    | Authenticate and receive JWT |
| `POST` | `/auth/logout`   | Invalidate session           |
| `GET`  | `/auth/me`       | Get current user info        |

### Logs API

| Method   | Endpoint       | Description                       |
| -------- | -------------- | --------------------------------- |
| `GET`    | `/logs`        | Get user's logs (paginated)       |
| `POST`   | `/logs`        | Create a new immersion log        |
| `PATCH`  | `/logs/:id`    | Update an existing log            |
| `DELETE` | `/logs/:id`    | Delete a log                      |
| `POST`   | `/logs/assign` | Assign media to logs              |
| `POST`   | `/logs/import` | Import logs from external sources |

### Media API

| Method | Endpoint           | Description                           |
| ------ | ------------------ | ------------------------------------- |
| `GET`  | `/search/:type`    | Search media (anime, manga, vn, etc.) |
| `GET`  | `/media/:type/:id` | Get media details                     |

### Users & Stats API

| Method  | Endpoint                 | Description             |
| ------- | ------------------------ | ----------------------- |
| `GET`   | `/users/:username`       | Get user profile        |
| `GET`   | `/users/:username/stats` | Get user statistics     |
| `PATCH` | `/users/settings`        | Update user settings    |
| `GET`   | `/ranking`               | Get global leaderboards |

### Goals API

| Method | Endpoint          | Description              |
| ------ | ----------------- | ------------------------ |
| `GET`  | `/goals/daily`    | Get daily goals          |
| `POST` | `/goals/daily`    | Create/update daily goal |
| `GET`  | `/goals/longterm` | Get long-term goals      |
| `POST` | `/goals/longterm` | Create long-term goal    |

### Clubs API

| Method | Endpoint           | Description       |
| ------ | ------------------ | ----------------- |
| `GET`  | `/clubs`           | List all clubs    |
| `POST` | `/clubs`           | Create a new club |
| `GET`  | `/clubs/:id`       | Get club details  |
| `POST` | `/clubs/:id/join`  | Join a club       |
| `POST` | `/clubs/:id/leave` | Leave a club      |

---

## 📁 Project Structure

```text
NihongoTracker/
├── Backend/
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── middlewares/     # Express middleware (auth, XP calc, etc.)
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # Business logic & external APIs
│   │   ├── libs/            # Utilities (JWT, auth helpers)
│   │   ├── types.ts         # TypeScript interfaces
│   │   └── app.ts           # Express app configuration
│   ├── build/               # Compiled JavaScript output
│   └── dist/                # Frontend assets (production)
│
├── Frontend/
│   ├── src/
│   │   ├── api/             # API client functions
│   │   ├── components/      # Reusable UI components
│   │   ├── screens/         # Page components
│   │   ├── store/           # Zustand state stores
│   │   ├── hooks/           # Custom React hooks
│   │   ├── contexts/        # React contexts
│   │   └── utils/           # Helper functions
│   └── public/              # Static assets
│
├── docker-compose.yml       # Docker orchestration
└── README.md
```

---

## 🤝 Contributing

Contributions are welcome! Whether it's bug fixes, new features, or documentation improvements.

### Development Workflow

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create** a feature branch: `git checkout -b feature/amazing-feature`
4. **Make** your changes
5. **Test** thoroughly
6. **Commit** with clear messages: `git commit -m "feat: add amazing feature"`
7. **Push** to your fork: `git push origin feature/amazing-feature`
8. **Open** a Pull Request

### Code Guidelines

- **TypeScript** — All code must be typed
- **ES Modules** — Use `.js` extensions in imports (TypeScript compiles to ESM)
- **Formatting** — Run Prettier before committing
- **Naming** — Use camelCase for variables/functions, PascalCase for components/classes

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New features
- `fix:` — Bug fixes
- `docs:` — Documentation changes
- `style:` — Code style changes (formatting, etc.)
- `refactor:` — Code refactoring
- `test:` — Adding or updating tests
- `chore:` — Maintenance tasks

---

## 💬 Support

Need help or have questions?

- 📖 Check the [Issues](https://github.com/HitogiDev/NihongoTracker/issues) page
- 🐛 [Report a bug](https://github.com/HitogiDev/NihongoTracker/issues/new?template=bug_report.md)
- 💡 [Request a feature](https://github.com/HitogiDev/NihongoTracker/issues/new?template=feature_request.md)
- ☕ Support development on [Patreon](https://www.patreon.com/nihongotracker)

---

## 📄 License

This project is licensed under the **ISC License** — see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for Japanese learners worldwide**

⭐ Star this repo if NihongoTracker helps your learning journey!
