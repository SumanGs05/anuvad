# Anuvad

Local MVP for translating English CIPAM documents into Hindi, Marathi, Bengali, Gujarati, Tamil, or Telugu.

## Setup

1. Copy `backend/.env.example` to `backend/.env` and configure these variables: `PORT`, `NODE_ENV`, `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `SARVAM_API_KEY`, `SARVAM_API_BASE_URL`, `MONGO_ENCRYPTION_KEY`, `MONGO_SIGNING_KEY`, and `CORS_ORIGIN`.
2. Copy `frontend/.env.example` to `frontend/.env` if the backend is not at `http://localhost:5000`.
3. Install packages in each directory:

   ```sh
   cd backend && npm install
   cd ../frontend && npm install
   ```

4. Start MongoDB locally, then run the backend and frontend in separate terminals:

   ```sh
   cd backend && npm run dev
   cd frontend && npm run dev
   ```

Open the Vite address shown in the terminal (normally `http://localhost:5173`).

## Tests

Run the backend suite with:

```sh
cd backend && npm test
```

The suite uses mocks for Sarvam requests and an in-memory MongoDB server for API integration tests.
