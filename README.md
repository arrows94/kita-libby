# Kita-Bibliothek

Kita-Bibliothek is a library management system tailored for kindergartens and daycares. It provides an intuitive interface to manage children's books, track views, organize by categories and colors, and easily add new books through automated metadata lookups.

## Features

- **Multi-Category Support:** Organize books into multiple categories for flexible discovery.
- **Color-Coded Tagging (Chips):** Assign up to three color tags to each book, making it easier for children and educators to find books.
- **Seasonal Recommendations:** Automated book recommendations based on keywords for Winter, Spring (Frühling), Summer (Sommer), and Autumn (Herbst).
- **Lookup & Enrichment:** Automatically fetch book metadata (title, authors, cover, description) using ISBN or title search via Open Library and Google Books.
- **Bulk Operations:** Update color tags or categories for multiple books at once.
- **Import/Export:** Support for importing and exporting the library catalog via CSV files.
- **Category Management:** Create, delete, rename, and merge categories easily.
- **View Tracking:** Tracks how often books are viewed or clicked.
- **Kiosk Mode:** A streamlined, read-only interface meant for display purposes.
- **Dark/Light Mode:** Toggle between light and dark themes for the user interface.

## Architecture & Tech Stack

- **Frontend:** React, built with Vite.
- **Backend:** Node.js, Express.js.
- **Database:** SQLite for local, lightweight data storage.
- **Deployment:** Docker & Docker Compose. Caddy is used as a reverse proxy to serve the frontend and route API requests to the backend.

## Configuration (Environment Variables)

The backend relies on the following environment variables. In a Docker setup, these can be passed via a `.env` file or directly in `docker-compose.yml`:

- `PORT` (default: `3001`) - The port the backend server listens on.
- `DB_FILE` (default: `./data.sqlite`) - The path to the SQLite database file.
- `ADMIN_PASSWORD` (default: `change-me`) - Password for the admin role (full access).
- `EDITOR_PASSWORD` (optional) - Password for the editor role (limited access, e.g., cannot delete books or manage categories/settings).
- `JWT_SECRET` (default: `dev-secret-change-me`) - Secret key for signing JSON Web Tokens.
- `GOOGLE_BOOKS_KEY` (optional) - API key for Google Books API to improve metadata lookups.

## Getting Started

### Using Docker (Recommended for Production)

1. Make sure you have Docker and Docker Compose installed.
2. Build the frontend and start the application:

```bash
# 1. Build the frontend assets
docker compose up --build -d frontend-build

# 2. Start the backend and Caddy web server
docker compose up -d
```

3. The application will be available at `http://<SERVER-IP>:8080/` (or `http://localhost:8080/`).

### Local Development

**1. Backend**
Navigate to the `backend` directory, install dependencies, and start the server:

```bash
cd backend
npm install
node server.js
```
The backend will run on `http://localhost:3001`.

**2. Frontend**
In a new terminal, navigate to the `frontend` directory, install dependencies, and start the Vite dev server:

```bash
cd frontend
npm install
npm run dev
```
The frontend will run on a local Vite server (e.g., `http://localhost:5173`).

*(Note: During local development without Caddy, ensure your frontend is configured to communicate with the backend at `http://localhost:3001` instead of the `/api` route.)*
