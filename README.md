# CCTV Mosaic for XENEON EDGE

Import `cctv-mosaic.icuewidget` using **Widgets → +** in iCUE 5.54 or later. Add it to a Medium slot (840×696 landscape or 696×840 portrait). Tap a camera to focus, tap the picture or **Back** to return, and tap **Pauze streams** to blank the screen and stop camera requests.

## Configure stream URLs

The widget starts with six camera aliases on the local go2rtc relay. iCUE settings accept comma-separated names and sources in matching order. Select four tiles to use the first four entries.

| Default label | NVR channel | Mosaic alias | Focus alias |
|---|---:|---|---|
| Voorgevel (D6) | 6 | `voorgevel` | `voorgevel_hd` |
| Zijgevel (D2) | 2 | `zijgevel` | `zijgevel_hd` |
| Leefruimte (D8) | 8 | `leefruimte` | `leefruimte_hd` |
| Tuin (D4) | 4 | `tuin` | `tuin_hd` |
| Keuken (D7) | 7 | `keuken` | `keuken_hd` |
| Boven (D5) | 5 | `boven` | `boven_hd` |

An alias resolves against the **Relay address** and **Relay port**, which default to `127.0.0.1:1984`. You can also enter a complete loopback URL such as `http://127.0.0.1:1984/api/frame.jpeg?src=tuin`. Focus aliases try `/api/stream.mjpeg` first and fall back to JPEG snapshots. For a focus entry given as a full JPEG URL, supply its matching MJPEG endpoint in **Focus MJPEG URLs** to enable continuous streaming. An empty focus entry uses the mosaic source at the same position. Alias names can contain letters, numbers, underscores, periods, and hyphens.

The package declares URL access to `127.0.0.1:1984` for camera images. iCUE may prompt for other loopback host/port combinations, including `localhost`. Snapshot refresh defaults to 2 seconds and focus returns after 60 seconds.

## Set up the relay

1. Extract the Windows build from [go2rtc releases](https://github.com/AlexxIT/go2rtc/releases) into a private directory such as `%LOCALAPPDATA%\go2rtc`. Ensure FFmpeg is on this Windows account's PATH, or set its absolute executable path with `ffmpeg.bin`.
2. Create `go2rtc.yaml` in that directory. Restrict its Windows file permissions to your account. Start with these listeners and example aliases.

   ```yaml
   api:
     listen: "127.0.0.1:1984"
   rtsp:
     listen: "127.0.0.1:8554"
   webrtc:
     listen: ""
     ice_servers: []
   streams:
     tuin: "<private URL for channel 4, subtype 1>"
     tuin_hd:
       - "<private URL for channel 4, subtype 0>"
       - "ffmpeg:tuin_hd#video=mjpeg"
   ```

   Add both aliases for each camera using the channel table. Use your NVR address and RTSP path. Use subtype 1 for mosaic if supported, or subtype 0 if the NVR offers only the main stream. The FFmpeg companion source enables continuous MJPEG for a focus stream that supplies H.264 or H.265. Keep the upstream camera URLs and view-only credentials in this local file, and leave CORS at its default. See the [go2rtc JPEG and MJPEG documentation](https://github.com/AlexxIT/go2rtc/blob/master/internal/mjpeg/README.md).
3. Start `go2rtc.exe` from that directory. Check each alias with its local JPEG URL before opening the widget. Compare main and sub-stream quality and relay CPU usage on the actual NVR.
4. To start the relay at Windows sign-in, open `shell:startup` from **Win+R**. Create a shortcut named **CCTV Mosaic Relay** pointing to `go2rtc.exe`. In the shortcut properties, set **Start in** to the folder containing `go2rtc.yaml` and **Run** to **Minimized**. Disable any existing go2rtc logon task if you switch to this shortcut.

Double-click the shortcut to start the relay immediately. To stop it, close the go2rtc console or end the `go2rtc.exe` process in Task Manager. To disable autostart, remove the shortcut from `shell:startup`.

Change camera labels in iCUE. To add or rename a stream, update both the relay aliases and the corresponding iCUE source positions. To rotate the NVR password, update the upstream URLs in the local YAML and restart go2rtc. The existing widget aliases still work.

Rebuild with `icuewidget validate widget` and `icuewidget package widget -o cctv-mosaic.icuewidget`.
