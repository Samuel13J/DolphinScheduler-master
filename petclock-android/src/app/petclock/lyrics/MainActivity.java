package app.petclock.lyrics;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.res.Configuration;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    static volatile String night = "day";
    private boolean asked;

    static void readNight(Configuration cfg) {
        int mask = cfg.uiMode & Configuration.UI_MODE_NIGHT_MASK;
        night = mask == Configuration.UI_MODE_NIGHT_YES ? "night" : "day";
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        readNight(getResources().getConfiguration());
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideBars();

        WebView web = new WebView(this);
        setContentView(web);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setTextZoom(100);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        web.setBackgroundColor(0xFF10100E);
        web.setWebViewClient(new StayClient());
        web.addJavascriptInterface(new ClockJs(), "AndroidClock");
        web.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    @Override
    protected void onResume() {
        super.onResume();
        readNight(getResources().getConfiguration());
        if (listenerOn()) {
            MediaBridge.askRebind(this);
        } else {
            maybeAsk();
        }
    }

    @Override
    public void onConfigurationChanged(Configuration cfg) {
        super.onConfigurationChanged(cfg);
        readNight(cfg);
    }

    @Override
    public void onBackPressed() {
        moveTaskToBack(true);
    }

    private void hideBars() {
        View decor = getWindow().getDecorView();
        int flags = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        decor.setSystemUiVisibility(flags);
    }

    private boolean listenerOn() {
        String flat = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        return flat != null && flat.indexOf(getPackageName()) >= 0;
    }

    private void maybeAsk() {
        if (asked) return;
        asked = true;
        new AlertDialog.Builder(this)
            .setTitle("读取正在播放的歌")
            .setMessage("打开「通知使用权」后，这张卡片才能显示车机正在放的歌。没开的话，画面会停在“还没有在放的歌”。")
            .setPositiveButton("去开启", new OpenListener(this))
            .setNegativeButton("稍后", null)
            .show();
    }

    void openListenerSettings() {
        try {
            startActivity(new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "请到系统设置里，给「歌词+时钟」打开通知使用权", Toast.LENGTH_LONG).show();
        }
    }
}

class StayClient extends WebViewClient {
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        return url != null && url.indexOf("file:") != 0;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        android.net.Uri uri = request.getUrl();
        String url = uri == null ? "about:blank" : uri.toString();
        return url.indexOf("file:") != 0;
    }
}

class OpenListener implements DialogInterface.OnClickListener {
    private final MainActivity activity;

    OpenListener(MainActivity activity) {
        this.activity = activity;
    }

    @Override
    public void onClick(DialogInterface dialog, int which) {
        activity.openListenerSettings();
    }
}
