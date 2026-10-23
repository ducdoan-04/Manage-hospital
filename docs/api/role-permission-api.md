# Role & Permission API Documentation

This document describes the REST APIs for managing Roles and evaluating Permissions within the NHMS system.

## Base URLs
- `/api/roles`
- `/api/permissions`

---

## 1. Get All Roles
- **Method:** `GET`
- **Endpoint:** `/api/roles`
- **Description:** Retrieves all active roles in the system.
- **Responses:**
  - `200 OK`: Returns an array of roles.

## 2. Get All Permissions
- **Method:** `GET`
- **Endpoint:** `/api/permissions`
- **Description:** Retrieves the list of all available system permissions (action codes).
- **Responses:**
  - `200 OK`: Returns an array of permissions (e.g., `USERS_VIEW`, `USERS_MANAGE`).

## 3. Get Role Permissions
- **Method:** `GET`
- **Endpoint:** `/api/roles/:id/permissions`
- **Description:** Retrieves the assigned permissions for a specific role to calculate the Role Matrix.
- **Path Parameters:**
  - `id`: The ID of the role.
- **Responses:**
  - `200 OK`: Returns an array of `action_code` strings assigned to the role.

## 4. Update Role Permissions
- **Method:** `PUT`
- **Endpoint:** `/api/roles/:id/permissions`
- **Description:** Updates the assigned permissions for a specific role (full replace).
- **Path Parameters:**
  - `id`: The ID of the role.
- **Body Payload (JSON):**
  - `permissions` (string[], required): Array of `action_code` strings (e.g., `["USERS_VIEW", "ROLES_VIEW"]`).
- **Responses:**
  - `200 OK`: Permissions updated successfully.
  - `400 Bad Request`: Validation failure.

---

## Matrix Calculation Logic
The User Interface evaluates the permissions using the following logic for each module (e.g., Users, Roles):

1. **Full Access (Green Badge):** 
   - Role has `MODULE_MANAGE` permission (e.g., `USERS_MANAGE`).
2. **View Access (Blue Badge):** 
   - Role has `MODULE_VIEW` permission but lacks `MODULE_MANAGE` (e.g., `USERS_VIEW`).
3. **Hidden / No Access (Strikethrough Badge):**
   - Role has neither `_MANAGE` nor `_VIEW` permissions for the module.
