# Expense Claim Portal

## Features

- Employee, Manager, Accounts, and Admin roles
- Employee claim submission with receipt images or PDFs
- Approval order: Submitted → Manager Approved → Accounts Approved → Paid
- Rejection with a required reason and a timestamped history on every claim
- Per-category claim limits and over-limit warnings
- Monthly reports by category, employee, and department, with charts and Excel export
- Cloudinary receipt storage for claim attachments and optional SMTP email alerts
- Browser OCR suggestions for receipt images

Starter category limits are Fuel Rs 5,000, Travel Rs 10,000, Meals Rs 2,500, and Petty Cash Rs 5,000. Administrators can edit these values in the portal.

## Local setup

1. Install backend dependencies with `npm install` in `backend`.
2. Copy `.env.example` to `.env`. Set `MONGO_URI` and a long random `JWT_SECRET`.
3. Set `ADMIN_NAME`, `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD` to create the first administrator on startup. Remove the bootstrap password from the environment after the account has been created.
4. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` for receipts. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and optionally `MAIL_FROM` for claim-status and signup decision email alerts.
5. Start the API with `npm run dev` in `backend`.
6. Install frontend dependencies with `npm install` in `frontend`, then run `npm run dev`. The Vite development server proxies `/api` to `http://localhost:5000`.

All public signup requests (Employee, Manager, Accounts, or Admin) remain inactive until an Admin approves them. Applicants receive an email when their request is approved or rejected. Administrators can also create accounts directly and assign departments. Only one active Manager is allowed; all employee claims appear in that Manager's review queue.

## Deployment configuration

Deploy MongoDB and the Node API, then deploy the Vite frontend as a static site. Configure the API's secrets and service credentials in the hosting provider's environment settings, restrict `CORS_ORIGIN` to the deployed frontend origin, and set frontend `VITE_API_URL` to the deployed API base URL plus `/api`. Use a persistent MongoDB service and Cloudinary (or another configured object store) for uploaded receipts. Do not commit `.env` or production credentials.

OCR runs in the browser for receipt images; the user must review extracted values before submitting. PDF receipts are accepted but are not OCR-scanned.
