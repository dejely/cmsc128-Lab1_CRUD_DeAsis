# CMSC 128 Lab 1 — Todo List CRUD

Todo List CRUD is a React Native app for keeping a personal task list. Users can create an account, sign in with a username or email, and manage tasks with a title, due date, priority, and category. Tasks are saved on the device first and synchronized with the API when a connection is available. The app also supports profile updates, task editing, confirmed deletion with a three-second undo option, and password recovery by email.

## Activity 3 branch and integration

Activity 3 is maintained on `act3-ubac` in the same repository as Activities 1 and 2, following the [Activity 3 branch requirements](https://github.com/CMSC128-njh/CMSC128_Lab_3_MultiUserCRUD_UBAC). The branch starts from the existing CRUD/authentication work on `feat/backend-server`, adds the authenticated user-owned task API, and merges `b7ab125` (`cmsc128-Indiv-Act2`), the integrated Activity 2 equivalent. This is a Git merge, with conflict resolutions committed on `act3-ubac`.

The conflicts covered the server schema, authentication, task routes, frontend session and database services, navigation, dependency lockfiles, and setup documentation. The resolution preserves Activity 2's profile editing, password recovery, SecureStore sessions, and offline task queue while adding tracked session revocation, stricter validation, and backend ownership checks. The backend feature commit on this branch has author and committer dates of October 21, 2026 (Asia/Manila).

## Features

The task form validates the title and due date and lets the user choose Low, Medium, or High priority and School, Personal, or Others category. The task list shows these details. Editing changes the task title; deletion asks for confirmation and can be undone for three seconds. Account data and tasks are isolated by user on the server. The app keeps a local SQLite copy and a sync queue so signed-in users can keep working while offline and sync later.

## Technology and data design

The mobile client uses React Native with Expo SDK 57, Expo Router, and TypeScript. Expo SQLite stores the local task cache and pending sync operations in `tasks.db`. The client talks to a Node.js and Express REST API. The backend uses SQLite through `better-sqlite3`, with its database stored at `backend/data.sqlite` by default.

Authentication is handled by the backend. It hashes passwords with bcrypt and returns a signed JSON Web Token (JWT) after registration or login. The client stores the JWT in Expo SecureStore and caches the signed-in profile in its local SQLite database. The API uses the token as a Bearer credential for protected profile and task operations. Tokens expire after one hour by default; `JWT_EXPIRES_IN` can change that duration.

The app writes task changes to its local database and queues them for `POST /todos/sync`. It synchronizes after sign-in and when the network becomes available. The backend creates its tables on startup and applies versioned, additive schema updates for older databases. It preserves both the existing sync schema and the PR’s earlier task schema. The mobile database also initializes and migrates automatically. There is no seed-data command; create an account in the app or call the registration endpoint.

## Install and run locally

Install Node.js and npm. The installed React Native version supports Node.js `20.19.4+`, `22.13.0+`, `24.3.0+`, or `25+`. For Android, install JDK 17 and Android Studio with Android SDK Platform 36, Build-Tools 36.0.0, Platform-Tools, and NDK 27.1.12297006. Start an Android emulator or connect an Android device with USB debugging enabled. Building for iOS requires macOS and Xcode.

Clone the repository and install the mobile app dependencies from the repository root:

```bash
git clone https://github.com/dejely/cmsc128-Lab1_CRUD_DeAsis.git
cd cmsc128-Lab1_CRUD_DeAsis
npm ci
cp .env.example .env
```

Edit `.env` and set `EXPO_PUBLIC_API_BASE_URL` to an address the app can reach. For the standard Android emulator, use `http://10.0.2.2:3000`. For a physical phone or tablet, use the computer's LAN IPv4 address, for example `http://192.168.1.100:3000`, and connect both devices to the same network.

Install the backend dependencies and create its environment file:

```bash
cd backend
npm ci
cp .env.example .env
```

Edit `backend/.env` and set `JWT_SECRET` to a random value of at least 32 bytes. The server refuses to start with a missing or shorter signing secret. For example, run this command from the `backend` directory and copy its output into the `JWT_SECRET` setting:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Email delivery is needed for password recovery. To enable it, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in `backend/.env`. If you are not configuring email, remove those sample settings or set them to empty values; account creation, login, and task sync do not require SMTP. `PORT` defaults to `3000`, `DB_PATH` defaults to `./data.sqlite` relative to `backend/`, and `RESET_APP_SCHEME` should remain `cmsc128lab1cruddeasis` to match the app's deep-link scheme.

Run the backend in one terminal from the `backend` directory:

```bash
npm run dev
```

In a second terminal, from the repository root, build and launch the Android app:

```bash
npm run android
```

The first Android run generates the native project as needed, builds and installs the app, and starts Metro. On macOS with Xcode, `npm run ios` builds and launches the iOS app. For later development sessions, `npm start` from the repository root starts Metro; press `a` to open the installed Android app. Keep the backend running in its own terminal. If using a physical Android device, make sure the computer firewall allows connections to port 3000.

## Database initialization

Starting the backend runs the initialization in [`backend/db.js`](backend/db.js). It creates the `users`, `todos`, `sessions`, `password_reset_tokens`, and `sync_operations` tables in the configured backend SQLite file and adds supported missing columns to older databases. No separate migration or seed command is required.

The app initializes `tasks.db` on first launch and stores its local tasks and sync queue there. Local changes remain available offline and are sent to the backend after connectivity returns. The local and backend databases are separate: the backend is the account-synced store, while the app database is its on-device cache and offline queue.

## API examples

The API listens on port 3000 by default. `GET /` is a health check. Create an account with `POST /auth/register` or sign in with `POST /auth/login`; login accepts either a username or email as `identifier`. Both return a JWT and public user profile. `GET /auth/me` and `PATCH /auth/me` read and update the signed-in profile.

For example, register an account with:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"alex","email":"alex@example.com","password":"ChangeMe123"}'
```

Copy the returned `token` and use it as a Bearer token for protected endpoints. The task API provides `GET /todos`, `POST /todos`, `PATCH /todos/:id`, and `DELETE /todos/:id`. The mobile app normally sends queued offline changes through `POST /todos/sync` instead. For example, create a task directly through the API with:

```bash
curl -X POST http://localhost:3000/todos \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "title":"Finish CMSC 128 report",
    "completed":0,
    "dueDate":"2026-10-10T00:00:00.000Z",
    "priority":"High",
    "category":"School",
    "clientId":"example-task-001"
  }'
```

The reset flow uses `POST /auth/reset-request` with an email address and `POST /auth/reset-confirm` with the emailed token and a new password. Protected endpoints require `Authorization: Bearer YOUR_TOKEN`.

## Session and password recovery

After registration or login, the API signs an HS256 JWT with an issuer, audience, and one-hour default lifetime. Its session ID is recorded in SQLite and checked on every protected request. The app stores it in SecureStore and restores the session on launch by checking `GET /auth/me`. If the API is temporarily unreachable and a cached profile exists, the app keeps the local session available for offline task work. On launch, an expired or rejected token clears the saved session. Logging out calls `POST /auth/logout` to revoke the server session, then removes the token and cached active profile from the device. A rejected protected request also clears the current saved session; a late response from an older login cannot clear a newer token.

Password recovery is initiated from the app's **Forgot Password** screen. The API generates a random, single-use token that expires after 30 minutes; it stores only the token's SHA-256 hash in the backend database and emails a deep link to the app. The user opens that link and submits a new password of at least eight characters. The backend bcrypt-hashes the new password and marks the reset token as used. The reset endpoint intentionally returns the same message for registered and unregistered email addresses. A reset link will only arrive when SMTP is configured and can deliver mail. A successful password reset revokes all of that account’s existing sessions. Reset confirmation rechecks the token inside the database transaction so simultaneous requests cannot reuse it.


## Validation and compatibility

`POST /auth/signup` remains an alias for `/auth/register`. Login accepts the existing `identifier` field (username or email) and the PR's `email` field. The existing profile, reset, and sync endpoints remain available. Direct task creation can generate a client ID when one is not supplied. Deletion keeps a tombstone for offline synchronization; the direct delete endpoint returns the deleted task, while ordinary task lists exclude deleted rows. Sync responses include tombstones so other devices can remove their cached copies.

Passwords must contain at least eight characters and at most 72 UTF-8 bytes. Task titles contain 1–200 characters after trimming, `completed` is integer 0 or 1, and dates use canonical ISO timestamps (or null for tasks without a due date). Unknown fields and client-supplied ownership IDs are rejected. The API limits JSON bodies to 100 KB and authentication requests to 20 per IP per 15 minutes. Set `CORS_ORIGINS` to a comma-separated list of allowed browser origins; native clients do not require CORS permission. Rate limits are per process, and proxy trust remains disabled.

Legacy device passwords are never used for authentication. Existing tasks without an owner remain on the device and are not automatically assigned or uploaded when another account signs in. Importing those tasks requires an explicit ownership decision. The server migrates its schema to version 2 without replacing account, task, or session rows. Previously issued tokens from the old server without a tracked session require a fresh login.

## Checks

Run `npm test --prefix backend` for HTTP integration tests against isolated databases. The suite covers hashing, validation, uniqueness, account isolation, token expiry and revocation, request limits, profile updates, offline-sync idempotency and tombstones, password recovery, and schema migration. `node --test scripts/test-api-client.cjs` checks the frontend transport and token-storage boundary with mocked fetch and SecureStore. `npx tsc --noEmit` checks mobile types. These checks do not prove native navigation, handset connectivity, or SMTP delivery.
