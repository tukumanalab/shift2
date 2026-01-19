# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a simple Japanese Google Login web application demonstrating OAuth2 authentication using Google Identity Services (GSI). The application consists of pure HTML, CSS, and vanilla JavaScript without any build system or package management.

## Development Commands

### Running the Application

The application uses a unified Express server that serves both the frontend and backend API:

```bash
# Development mode with hot reload (recommended)
npm run dev

# Production build and start
npm run build
npm start
```

Access the application at `http://localhost:3000`

The server provides:
- **Frontend**: Static files (index.html, app.js, config.js, etc.)
- **Backend API**: RESTful endpoints for users, special shifts, etc.
- **Database**: SQLite integration

### Alternative: Frontend-only Server

If you need to run just the frontend with a static file server:

```bash
# Static file server on port 8080
npm run dev:static

# Or use other tools
npx http-server -p 8080
python -m http.server 8080
```

**Note**: When using a separate frontend server, you'll need to update the API_BASE_URL in config.js accordingly.

### File Serving Requirements
- Must run on localhost or HTTPS (Google OAuth requirement)
- Port 3000 is the default (configurable via .env PORT)

### Google Apps Script Deployment (Legacy)
Deploy the backend Google Apps Script code using:

```bash
npm run deploy:gas
```

This command automatically updates the Google Apps Script project with the latest code from `gas/google-apps-script.js`.

**Note**: User management has been migrated to Express + TypeScript backend with SQLite database.

## Current Specifications

### Application Overview
This is a Japanese shift management web application with Google OAuth authentication. Users can:
- View and manage work shifts
- Set capacity (required staff) for each date
- Submit shift requests for specific time slots
- View remaining available slots in real-time

### Core Features

#### 1. Authentication & Authorization
- **Google OAuth Integration**: Uses Google Identity Services (GSI) for login
- **Email-based Authorization**: Only users with authorized email addresses can access
- **Admin Role Management**: Admin users have additional permissions for capacity settings

#### 2. Shift Management System
- **Time Slots**: 30-minute intervals from 13:00 to 18:00 (13:00-13:30, 13:30-14:00, etc.)
- **Date Range**: Supports shifts from current date through next fiscal year (March 31)
- **Real-time Availability**: Shows remaining slots based on capacity settings and current applications

#### 3. Capacity Management
- **Default Capacity by Day of Week**:
  - Sunday/Saturday: 0 people (no shifts)
  - Wednesday: 2 people
  - Monday/Tuesday/Thursday/Friday: 3 people
- **Custom Capacity Setting**: Admin users can override default capacity for specific dates
- **Real-time Updates**: Capacity changes immediately reflect in available slots

#### 4. Data Storage & Backend
- **Google Spreadsheet Backend**: All data stored in Google Sheets
- **Google Apps Script API**: Handles server-side logic and data processing
- **Google Calendar Integration**: Automatically syncs approved shifts to Google Calendar

### Technical Architecture

#### Frontend (Client-side)
- **Pure HTML/CSS/JavaScript**: No build system or frameworks
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time UI Updates**: Immediate feedback on capacity and availability changes

#### Backend Architecture (Hybrid)

**Express + TypeScript Backend (New)**:
- **Framework**: Express.js with TypeScript
- **Database**: SQLite (better-sqlite3)
- **User Management API**: RESTful endpoints for user operations
- **Hot Reload**: Nodemon for development
- **Type Safety**: Full TypeScript support

**Google Apps Script Backend (Legacy)**:
- **RESTful API**: Handles GET/POST requests for shift and capacity operations
- **Spreadsheet Integration**: Direct integration with Google Sheets for shift data
- **Calendar Sync**: Automatic event creation in Google Calendar
- **Property Service**: Secure storage of configuration settings

**Migration Status**:
- ✅ User Management: Migrated to Express + TypeScript + SQLite
- ⏳ Shift Management: Still using Google Apps Script
- ⏳ Capacity Management: Still using Google Apps Script
- ⏳ Calendar Integration: Still using Google Apps Script

#### Data Structure

**SQLite Database (New - for User Management)**:
- **users**: User registration data
  - Columns: id, user_id, name, email, picture, nickname, real_name, created_at, updated_at
  - Primary Key: id (auto-increment)
  - Unique Index: user_id
  - Indexes: user_id, email

**Spreadsheet Sheets (Legacy - for Shifts and Capacity)**:
1. **シフト (Shifts)**: Individual shift applications
   - Columns: Timestamp, UserID, UserName, Email, Date, TimeSlot, Content
2. **人数設定 (Capacity)**: Daily capacity settings
   - Columns: Timestamp, Date, Capacity, UpdaterID, UpdaterName
3. **ユーザー (Users)**: User registration data (**DEPRECATED - migrated to SQLite**)
   - Columns: Timestamp, UserID, Name, Email, ProfileImageURL

### Key Algorithms

#### Remaining Slots Calculation
```
remainingSlots = configuredCapacity - currentApplications
```

#### Default Capacity Assignment
- Based on day of week with configurable overrides
- Automatically initializes capacity for entire fiscal year

#### Time Slot Generation
- Generates 30-minute intervals programmatically
- Supports flexible time range configuration

### Development & Deployment

#### Local Development
- Use `npm run dev` to start local server on port 8081
- Google OAuth requires localhost or HTTPS

#### Backend Deployment  
- Use `npm run deploy:gas` to deploy Google Apps Script code
- Automatically updates backend with latest changes

#### Configuration
- Google OAuth Client ID configured in both frontend and backend
- Calendar ID stored securely in Google Apps Script Properties Service
- Authorized user emails managed through configuration

### Security Considerations
- **Client-side Token Processing**: JWT tokens decoded on client-side only
- **Email-based Access Control**: Restricts access to authorized users only
- **No Server-side Session**: Stateless authentication using Google tokens
- **Secure Configuration**: Sensitive settings stored in Google Apps Script Properties

This system provides a complete shift management solution with real-time availability tracking and seamless integration with Google services.

## Architecture

### File Structure
- `index.html` - Single-page application with embedded CSS
- `app.js` - Authentication logic and DOM manipulation
- `README.md` - Japanese documentation with setup instructions

### Authentication Flow
1. Google Identity Services initializes on page load
2. User clicks Google Sign-In button → triggers popup OAuth flow
3. `handleCredentialResponse()` receives JWT token from Google
4. `decodeJwtResponse()` manually decodes JWT payload
5. `showProfile()` displays user information and switches UI state
6. `signOut()` clears session and resets UI

### Google OAuth Configuration
- Client ID is hardcoded in both `index.html` and `app.js`
- Current client ID: `your_google_client_id_here`
- Authorized origins configured for localhost:8081 and 127.0.0.1:8081

## Key Implementation Details

### JWT Token Handling
The application manually decodes Google's JWT tokens using base64 URL decoding rather than using a JWT library. The `decodeJwtResponse()` function handles the token parsing.

### UI State Management
Two main UI states managed through CSS classes:
- Login state: `#loginSection` visible, `#profileSection` hidden
- Authenticated state: `#loginSection` hidden, `#profileSection` visible

### Security Considerations
- This is a demo/learning application with hardcoded credentials
- Google OAuth tokens are processed client-side only
- No server-side validation or session management
- Suitable for development/educational purposes only

## Development Workflow

### Branch Management

**IMPORTANT**: Do NOT commit directly to the `main` branch.

All changes must follow this workflow:

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/<descriptive-name>
   ```

2. **Make your changes and commit**:
   ```bash
   git add <files>
   git commit -m "Your commit message"
   ```

3. **Push to the feature branch**:
   ```bash
   git push origin feature/<descriptive-name>
   ```

4. **Create a Pull Request** on GitHub

5. **After PR approval**, merge to main via GitHub's merge button

**Never use**:
```bash
git push origin main  # ❌ Forbidden
```

### Creating Pull Requests

When creating a pull request, follow these guidelines:

1. **Code Simplification**: Always use `code-simplifier` to simplify and optimize code before creating a PR
   ```bash
   # Run code-simplifier on modified files
   npx code-simplifier <file-path>
   ```

2. **Commit Guidelines**:
   - Write clear, descriptive commit messages in Japanese
   - Include co-authorship for AI-assisted development:
     ```
     Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
     ```

3. **PR Description**:
   - Summarize changes in Japanese
   - Include before/after screenshots for UI changes
   - List any breaking changes or migration steps required

4. **Testing**:
   - Test both frontend and backend changes locally
   - Verify that existing functionality still works
   - For database migrations, test the migration script before merging