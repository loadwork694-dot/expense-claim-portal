# Expense Claim Portal frontend

## Run locally

Install dependencies with `npm install`, then start Vite with `npm run dev`. The development server proxies `/api` requests to `http://localhost:5000`.

For a separately hosted API, set `VITE_API_URL` to its `/api` base URL before building with `npm run build`.

## Portal areas

- Each role opens its own dashboard: Employees track and submit claims, the single Manager reviews all employees' submissions, Accounts handles final approvals and payment, and Admins see organization-wide users, categories, and claim stages.
- Public signup creates Employee accounts only. Admins create the other roles and assign departments. Only one active Manager can be created.
- Employees submit claims, attach a camera photo or PDF receipt, run optional OCR on images, and follow claim history.
- The Manager reviews all submitted claims without employee-by-employee assignments.
- Accounts completes final approval and marks approved claims as paid.
- Admins create users, assign departments, and manage category limits.
- Accounts and Admins can view monthly charts and export an Excel report.

Receipt images are compressed in the browser. The backend still enforces the 5 MB limit and file type.
