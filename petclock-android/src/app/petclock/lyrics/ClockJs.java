package app.petclock.lyrics;

import android.webkit.JavascriptInterface;

public class ClockJs {
    @JavascriptInterface
    public String poll() {
        return MediaBridge.poll();
    }

    @JavascriptInterface
    public String lyrics() {
        return MediaBridge.lyrics();
    }

    @JavascriptInterface
    public String nightMode() {
        return MainActivity.night;
    }

    @JavascriptInterface
    public void play() {
        MediaBridge.transport("play");
    }

    @JavascriptInterface
    public void pause() {
        MediaBridge.transport("pause");
    }

    @JavascriptInterface
    public void previous() {
        MediaBridge.transport("previous");
    }

    @JavascriptInterface
    public void next() {
        MediaBridge.transport("next");
    }
}
