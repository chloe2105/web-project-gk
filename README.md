# SnapJournal - Progressive Web App

**Course:** Web Programming & Applications - 503073
**Semester:** 1 - Academic Year 2026-2027
**Topic:** Progressive Web Apps (PWAs)

## Project Description
SnapJournal is a local-first photo diary PWA. Users can capture photos using their device camera, add notes, and store them securely in the browser's IndexedDB. The app uses a Service Worker to cache the App Shell, allowing it to work fully offline. It is installable on desktop and mobile devices.

## Setup and Testing Instructions
1. **Prerequisites:** Ensure you have [Node.js](https://nodejs.org/) installed (or VS Code with the Live Server extension).
2. **Local Server:** PWA Service Workers require a secure context (localhost or HTTPS). You **cannot** just double-click `index.html`.
   * Open the terminal in this project folder.
   * Run: `npx serve .` (or use VS Code Live Server).
3. **Running the App:** Open `http://localhost:3000` in Google Chrome.
4. **Testing PWA Features:**
   * **Installable:** Look for the install icon in the Chrome address bar.
   * **Offline Mode:** Open Chrome DevTools (F12) -> Application -> Service Workers. Check the "Offline" box. Refresh the page. The UI should still load.
   * **Camera:** Click "Mở camera" and grant permission.
5. **No Login Required:** As per Tier 1 guidelines, this app requires no backend or authentication.