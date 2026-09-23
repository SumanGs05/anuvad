# Anuvad

Local MVP for translating English CIPAM documents into Hindi, Marathi, Bengali, Gujarati, Tamil, or Telugu.

See [DEPLOY.md](./DEPLOY.md) for the full Railway + Vercel deployment guide and pre-deploy checklist.

## Local Setup

1. Copy `backend/.env.example` to `backend/.env` and fill in the values.
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

## Architecture

- **Backend:** Node.js + Express + Mongoose, hosted on Railway
- **Frontend:** React + Vite, hosted on Vercel
- **Translation:** Sarvam AI (translate API + optional 105B refinement)
- **Storage:** Local filesystem on a Railway volume
