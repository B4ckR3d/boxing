# REST API Documentation — Boxing Championship Platform

> **Status:** v1.0  
> **Source of Truth:** [prd.md](../prd.md)  
> **Base URL:** `/api`  

---

## 1. Authentication Endpoints

### `POST /api/auth/login`
Authenticates user credentials and establishes an HTTP-only secure cookie session.

**Rate Limit:** 10 requests / 15 minutes per email, 30 requests / 15 minutes per IP.

**Request Body:**
```json
{
  "email": "admin@boxing.local",
  "password": "Demo-Ringside-2026!"
}
```

**Response (200 OK — Standard Login):**
```json
{
  "success": true,
  "user": {
    "id": "cm3abc1230000",
    "email": "admin@boxing.local",
    "name": "Platform Admin",
    "roles": ["administrator"]
  }
}
```
*Sets cookie `__Host-bx_session` with HttpOnly, Secure, SameSite=Lax flags.*

**Response (200 OK — MFA Step-Up Required):**
```json
{
  "requiresMfa": true,
  "tempToken": "base64url-temporary-preauth-token"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Invalid email or password"
}
```

**Response (429 Too Many Requests):**
```json
{
  "error": "Too many login attempts. Please wait 450 seconds."
}
```

---

### `POST /api/auth/logout`
Revokes the current active session in the database and clears the session cookie.

**Response (200 OK):**
```json
{
  "success": true
}
```

---

## 2. Public Data Endpoints

### `GET /api/rankings`
Retrieves published official rankings for a specified division or pound-for-pound.

**Query Parameters:**
- `scopeKey` (optional): e.g. `DIV:heavyweight`, `P4P:MALE`

**Response (200 OK):**
```json
{
  "versionNumber": 1,
  "effectiveDate": "2026-11-01T00:00:00.000Z",
  "notes": "Official Heavyweight Divisional Rankings",
  "entries": [
    {
      "rank": null,
      "isChampion": true,
      "fighterName": "Marcus Vale",
      "fighterSlug": "marcus-iron-vale",
      "record": "28-0-0",
      "points": 1500.0,
      "movement": 0
    },
    {
      "rank": 1,
      "isChampion": false,
      "fighterName": "Dario Storm",
      "fighterSlug": "dario-storm",
      "record": "24-1-0",
      "points": 1320.0,
      "movement": 2
    }
  ]
}
```

---

### `GET /api/fighters`
Searchable fighter directory with pagination.

**Query Parameters:**
- `q` (optional): Search query matching first name, last name, or ring alias.
- `division` (optional): Weight class slug.
- `page` (optional, default 1)
- `limit` (optional, default 20)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "cm3fgt123000",
      "slug": "marcus-iron-vale",
      "fullName": "Marcus Vale",
      "ringName": "Iron",
      "division": "Heavyweight",
      "nationality": "US",
      "stance": "ORTHODOX",
      "record": "28-0-0",
      "koWins": 24
    }
  ],
  "meta": {
    "total": 6,
    "page": 1,
    "limit": 20
  }
}
```
*Note: Private attributes (`contactEmail`, `contactPhone`, `privateNotes`) are strictly omitted.*

---

## 3. Administrative Mutation Safeguards

All endpoints modifying data require:
1. Valid session with appropriate permission.
2. `x-csrf-token` header matching the active session HMAC.
3. Strict Zod schema validation.
4. Automatic entry generated in `AuditLog` table.

