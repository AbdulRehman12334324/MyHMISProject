# HIMS Patient Intake Form v2.0

Secure 10-step patient registration wizard for Hospital Management Information Systems.

## Features
- JWT authentication (login required — no public routes)
- Role-based access: RECEPTIONIST, NURSE, DOCTOR, ADMIN, SUPER_ADMIN
- Doctor patient scoping (doctors see only own patients)
- Break-the-Glass emergency bypass with mandatory audit trail
- Live BMI auto-calculation
- Vital signs with range guards matching PostgreSQL CHECK constraints
- 16 chronic condition toggles
- Smart branching: OPD skips admission, non-corporate skips insurance
- CNIC/mobile encrypted at rest — hint shown in UI
- Registration Summary on Step 10 before final submit
- Copy-ready MR# success screen

## Setup

```bash
npm install
cp .env.example .env.local
# Set VITE_API_URL to your backend URL
npm run dev
```

## Production Build

```bash
npm run build
# Output in dist/ — serve with nginx
```

## Backend Requirements
FastAPI backend must be running with:
- POST /api/v1/auth/login
- POST /api/v1/auth/logout
- POST /api/v1/auth/btg/activate
- POST /api/v1/patients
- GET  /api/v1/consultants
- GET  /api/v1/departments
- GET  /api/v1/wards
- GET  /api/v1/beds/available
- GET  /api/v1/corporate-clients

See backend files: auth_v2.py, patients_api_secure.py, auth_router.py
