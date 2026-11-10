package app.petclock.lyrics;

import android.content.ComponentName;
import android.content.Context;
import android.graphics.Bitmap;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.SystemClock;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MediaBridge extends NotificationListenerService {
    private static volatile MediaController bound;
    private static MediaController.Callback boundCb;
    private static String lrcRaw = "";
    private static String lrcTrack = "";
    private static List<Line> lrcLines = new ArrayList<Line>();
    private static String lrcJson = "{\"trackId\":\"\",\"lines\":[]}";
    private static String coverKey = "";
    private static String coverUrl = "";

    static final class Line {
        long time;
        String text;
    }

    public static void askRebind(Context ctx) {
        if (Build.VERSION.SDK_INT >= 24) {
            try {
                requestRebind(new ComponentName(ctx, MediaBridge.class));
            } catch (Throwable ignored) {}
        }
    }

    public static String poll() {
        MediaController c = bound;
        if (c == null) return empty();
        try {
            return build(c);
        } catch (Throwable t) {
            return empty();
        }
    }

    public static String lyrics() {
        return lrcJson;
    }

    public static void transport(final String cmd) {
        final MediaController c = bound;
        if (c == null) return;
        android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
        handler.post(new Transport(c, cmd));
    }

    @Override
    public void onListenerConnected() {
        refresh();
    }

    @Override
    public void onListenerDisconnected() {
        clearBound();
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        refresh();
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        refresh();
    }

    void refreshFromWatch() {
        refresh();
    }

    private void refresh() {
        MediaController next = null;
        int best = -1;
        try {
            MediaSessionManager msm = (MediaSessionManager) getSystemService(Context.MEDIA_SESSION_SERVICE);
            List<MediaController> list = msm.getActiveSessions(new ComponentName(this, MediaBridge.class));
            for (int i = 0; i < list.size(); i++) {
                MediaController c = list.get(i);
                int score = 0;
                MediaMetadata md = c.getMetadata();
                PlaybackState st = c.getPlaybackState();
                if (md != null && text(md, MediaMetadata.METADATA_KEY_TITLE).length() > 0) score += 2;
                if (playing(st)) score += 4;
                if (score > best) {
                    best = score;
                    next = c;
                }
            }
        } catch (Throwable ignored) {
            next = null;
            best = -1;
        }
        if (best < 2) next = null;
        bind(next);
    }

    private void bind(MediaController next) {
        if (same(bound, next)) return;
        clearBound();
        bound = next;
        if (next == null) return;
        boundCb = new SessionWatch(this);
        try {
            next.registerCallback(boundCb);
        } catch (Throwable ignored) {}
    }

    private void clearBound() {
        MediaController old = bound;
        MediaController.Callback cb = boundCb;
        bound = null;
        boundCb = null;
        if (old != null && cb != null) {
            try { old.unregisterCallback(cb); } catch (Throwable ignored) {}
        }
    }

    private static boolean same(MediaController a, MediaController b) {
        if (a == b) return true;
        if (a == null || b == null) return false;
        try {
            return a.getSessionToken().equals(b.getSessionToken());
        } catch (Throwable t) {
            return false;
        }
    }

    private static String build(MediaController c) throws JSONException {
        MediaMetadata md = c.getMetadata();
        PlaybackState st = c.getPlaybackState();
        String title = text(md, MediaMetadata.METADATA_KEY_TITLE);
        if (title.length() == 0) title = text(md, MediaMetadata.METADATA_KEY_DISPLAY_TITLE);
        if (title.length() == 0) return empty();
        String artist = text(md, MediaMetadata.METADATA_KEY_ARTIST);
        if (artist.length() == 0) artist = text(md, MediaMetadata.METADATA_KEY_ALBUM_ARTIST);
        if (artist.length() == 0) artist = text(md, MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE);
        String album = text(md, MediaMetadata.METADATA_KEY_ALBUM);
        String id = text(md, MediaMetadata.METADATA_KEY_MEDIA_ID);
        long dur = md == null ? 0 : md.getLong(MediaMetadata.METADATA_KEY_DURATION);
        if (id.length() == 0) id = title + "\n" + artist + "\n" + dur;
        long pos = position(st);
        String raw = lyricsOf(md);
        rememberLyrics(id, raw);
        String current = lineAt(pos);
        if (current.length() == 0) {
            String desc = text(md, MediaMetadata.METADATA_KEY_DISPLAY_DESCRIPTION);
            if (desc.length() > 0 && desc.length() <= 48 && desc.indexOf('\n') < 0 && !desc.equals(title) && !desc.equals(artist)) {
                current = desc;
            }
        }
        String cover = coverOf(md, id);
        JSONObject o = new JSONObject();
        o.put("status", "ok");
        o.put("trackId", id);
        o.put("title", title);
        o.put("artist", artist.length() > 0 ? artist : album);
        o.put("packageName", c.getPackageName() == null ? "" : c.getPackageName());
        o.put("playing", playing(st));
        o.put("positionMs", pos);
        o.put("durationMs", dur);
        o.put("lyric", current);
        o.put("coverUrl", cover);
        o.put("updatedAt", System.currentTimeMillis());
        return o.toString();
    }

    private static String empty() {
        return "{\"status\":\"empty\",\"updatedAt\":" + System.currentTimeMillis() + "}";
    }

    private static boolean playing(PlaybackState st) {
        if (st == null) return false;
        int s = st.getState();
        return s == PlaybackState.STATE_PLAYING || s == PlaybackState.STATE_BUFFERING;
    }

    private static long position(PlaybackState st) {
        if (st == null) return 0;
        long pos = st.getPosition();
        if (playing(st)) {
            long updated = st.getLastPositionUpdateTime();
            if (updated > 0) {
                float speed = st.getPlaybackSpeed();
                if (speed <= 0) speed = 1f;
                pos += (long) ((SystemClock.elapsedRealtime() - updated) * speed);
            }
        }
        return pos < 0 ? 0 : pos;
    }

    private static String text(MediaMetadata md, String key) {
        if (md == null) return "";
        try {
            CharSequence v = md.getText(key);
            return v == null ? "" : v.toString();
        } catch (Throwable t) {
            return "";
        }
    }

    private static String lyricsOf(MediaMetadata md) {
        if (md == null) return "";
        String direct = text(md, "android.media.metadata.LYRICS");
        if (direct.length() == 0) direct = text(md, "lyrics");
        if (direct.length() == 0) direct = text(md, "LYRICS");
        if (direct.length() > 0) return direct;
        String best = "";
        try {
            for (String key : md.keySet()) {
                if (key == null) continue;
                String low = key.toLowerCase(Locale.US);
                if (low.indexOf("lyric") < 0 && low.indexOf("lrc") < 0) continue;
                String v = text(md, key);
                if (v.length() > best.length()) best = v;
            }
        } catch (Throwable ignored) {}
        return best;
    }

    private static void rememberLyrics(String trackId, String raw) {
        if (raw == null) raw = "";
        if (raw.equals(lrcRaw) && trackId.equals(lrcTrack)) return;
        lrcRaw = raw;
        lrcTrack = trackId;
        lrcLines = parseLrc(raw);
        try {
            JSONObject o = new JSONObject();
            o.put("trackId", trackId);
            JSONArray arr = new JSONArray();
            for (int i = 0; i < lrcLines.size(); i++) {
                Line line = lrcLines.get(i);
                JSONObject one = new JSONObject();
                one.put("text", line.text);
                one.put("timeMs", line.time);
                arr.put(one);
            }
            o.put("lines", arr);
            lrcJson = o.toString();
        } catch (JSONException e) {
            lrcLines = new ArrayList<Line>();
            lrcJson = "{\"trackId\":\"\",\"lines\":[]}";
        }
    }

    private static String lineAt(long pos) {
        String current = "";
        for (int i = 0; i < lrcLines.size(); i++) {
            Line line = lrcLines.get(i);
            if (line.time <= pos) current = line.text;
            else break;
        }
        return current;
    }

    private static List<Line> parseLrc(String raw) {
        ArrayList<Line> out = new ArrayList<Line>();
        if (raw == null || raw.length() == 0) return out;
        Pattern p = Pattern.compile("\\[(\\d{1,2}):(\\d{2})(?:[.:](\\d{1,3}))?]");
        String[] rows = raw.split("\\r?\\n");
        for (int r = 0; r < rows.length; r++) {
            String row = rows[r];
            Matcher m = p.matcher(row);
            int last = 0;
            ArrayList<Long> times = new ArrayList<Long>();
            while (m.find()) {
                last = m.end();
                int min = Integer.parseInt(m.group(1));
                int sec = Integer.parseInt(m.group(2));
                String frac = m.group(3);
                int ms = 0;
                if (frac != null) {
                    if (frac.length() == 1) ms = Integer.parseInt(frac) * 100;
                    else if (frac.length() == 2) ms = Integer.parseInt(frac) * 10;
                    else ms = Integer.parseInt(frac.substring(0, 3));
                }
                times.add(Long.valueOf((long) min * 60000L + sec * 1000L + ms));
            }
            if (times.isEmpty()) continue;
            String text = row.substring(last).trim();
            if (text.length() == 0) continue;
            for (int i = 0; i < times.size(); i++) {
                Line line = new Line();
                line.time = times.get(i).longValue();
                line.text = text;
                out.add(line);
            }
        }
        for (int i = 1; i < out.size(); i++) {
            Line key = out.get(i);
            int j = i - 1;
            while (j >= 0 && out.get(j).time > key.time) {
                out.set(j + 1, out.get(j));
                j--;
            }
            out.set(j + 1, key);
        }
        return out;
    }

    private static String coverOf(MediaMetadata md, String id) {
        if (md == null) return "";
        String key = id;
        if (key.equals(coverKey) && coverUrl.length() > 0) return coverUrl;
        Bitmap bmp = null;
        try { bmp = md.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART); } catch (Throwable ignored) {}
        if (bmp == null) {
            try { bmp = md.getBitmap(MediaMetadata.METADATA_KEY_ART); } catch (Throwable ignored) {}
        }
        if (bmp == null) {
            coverKey = key;
            coverUrl = "";
            return "";
        }
        Bitmap small = bmp;
        int w = bmp.getWidth();
        int h = bmp.getHeight();
        int max = 96;
        if (w > max || h > max) {
            float scale = max / (float) Math.max(w, h);
            small = Bitmap.createScaledBitmap(bmp, Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)), true);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        small.compress(Bitmap.CompressFormat.JPEG, 45, out);
        if (small != bmp) small.recycle();
        coverKey = key;
        coverUrl = "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        return coverUrl;
    }
}

class Transport implements Runnable {
    private final MediaController controller;
    private final String cmd;

    Transport(MediaController controller, String cmd) {
        this.controller = controller;
        this.cmd = cmd;
    }

    @Override
    public void run() {
        try {
            MediaController.TransportControls t = controller.getTransportControls();
            if ("play".equals(cmd)) t.play();
            else if ("pause".equals(cmd)) t.pause();
            else if ("next".equals(cmd)) t.skipToNext();
            else if ("previous".equals(cmd)) t.skipToPrevious();
        } catch (Throwable ignored) {}
    }
}

class SessionWatch extends MediaController.Callback {
    private final MediaBridge bridge;

    SessionWatch(MediaBridge bridge) {
        this.bridge = bridge;
    }

    @Override
    public void onSessionDestroyed() {
        bridge.refreshFromWatch();
    }
}

