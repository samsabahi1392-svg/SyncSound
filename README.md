# SyncSound — 10-phone prototype

## Phone-only GitHub upload
1. Extract `SyncSound-Phone-10.zip` using Android Files.
2. In GitHub repository, choose Add file > Upload files. Upload the four files `index.html`, `app.js`, `server.js`, `package.json` to the repository root. If multi-file selection fails, upload them one at a time.
3. This is a Node.js server app. GitHub Pages alone cannot run it. Deploy the GitHub repository as a Node web service on a host supporting WebSockets and HTTPS (e.g. Render if its current plan supports your use). Build command `npm install`; start command `npm start`.
4. Open the deployed HTTPS URL on two phones. One hosts, the other joins with the six-digit code. Tap Enable Audio on both phones, upload a supported audio file on host, then Play.

## Limits
Maximum 10 total phones including host. Server stores rooms and uploaded audio in RAM; a restart erases both. Rooms close when host disconnects. Synchronization is experimental, not measured or guaranteed <20 ms. Playback requires a user tap on each phone. No native Bluetooth discovery. Use only audio you have rights to distribute.
