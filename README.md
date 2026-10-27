# SyncSound — 10 phones, party/stereo/surround + experimental mic calibration
Use at : https://syncsound-cq1c.onrender.com

## Deploy on Render from your phone
Extract the ZIP and upload all five files to the **root** of your GitHub SyncSound repository, replacing the old versions. Render build command: `npm install`. Start command: `npm start`. Redeploy the latest commit. Open the HTTPS Render URL on each phone.

## Sound modes
- **Party:** all connected phones play the same track (mono downmix for stereo files is approximate).
- **Stereo:** exactly two connected phones, automatically left/right by join order. Playback is blocked if fewer/more than two phones are connected. Stereo uses the left/right source channel; a phone may play that channel on only one physical speaker output depending on its hardware.
- **Surround:** host assigns front left/right, rear left/right and center. Unassigned phones are silent. Rear positions repeat stereo side material; this is NOT true multichannel surround decoding. Surround positions are shown in the app.

## Experimental microphone calibration
On the receiving phone press **Listen with Microphone**, grant permission, then on host press **Emit Test Pulse**. The host produces a short 950 Hz tone; receiving phone measures microphone signal amplitude and estimates acoustic arrival time relative to server clock. It offers an offset to apply. This is a rough experiment, not reliable automatic millisecond calibration. Echo cancellation, speaker latency, noise, distance, microphone permissions, and background throttling can all distort measurements. Test in a quiet room at moderate volume. The host must have audio unlocked by tapping Enable Audio. Microphone recordings are processed locally and not uploaded.

## Limits
10 total devices including host. Rooms/audio live in server RAM, so Render restarts erase them. A room can be resumed after transient disconnects while server remains alive. Upload up to 40 MB using HTTP. Browsers may suspend audio in background. Playback synchronization has not been measured on physical phones and <20 ms is not guaranteed. Only upload audio you have rights to distribute.


## YouTube integration
Host can share a public YouTube URL; each participant gets the official privacy-enhanced embedded player and must press Play manually. YouTube audio is not redistributed, decoded, channel-separated, or synchronized. Party mode can show the same video on each phone, but playback may echo. Stereo and Surround modes work only with uploaded audio. Some videos disallow embedding.
