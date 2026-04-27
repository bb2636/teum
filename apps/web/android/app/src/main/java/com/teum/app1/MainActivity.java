package com.teum.app1;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.os.Bundle;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.community.admob.AdMob;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AdMob.class);
        super.onCreate(savedInstanceState);

        // Android 15+ (SDK 35+) enforces edge-to-edge: the activity window extends
        // beneath the status bar, navigation bar and display cutout. Without
        // padding, third-party modals (e.g. NicePay payment UI) get drawn behind
        // the phone's system bars and become unreachable. Apply system-bar insets
        // to the activity's root content view so the entire app surface is pushed
        // inside the safe area instead of trying to hide the system UI.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        final View rootContent = findViewById(android.R.id.content);
        if (rootContent != null) {
            ViewCompat.setOnApplyWindowInsetsListener(rootContent, (v, insets) -> {
                Insets bars = insets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsetsCompat.CONSUMED;
            });
            ViewCompat.requestApplyInsets(rootContent);
        }

        if (this.bridge != null && this.bridge.getWebView() != null) {
            final WebView webView = this.bridge.getWebView();
            webView.addJavascriptInterface(new ImmersiveBridge(this), "AndroidImmersive");
        }

        this.bridge.setWebViewClient(new BridgeWebViewClient(this.bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();

                if (url.startsWith("intent://")) {
                    try {
                        Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                        if (intent.resolveActivity(getPackageManager()) != null) {
                            startActivity(intent);
                            return true;
                        }
                        String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                        if (fallbackUrl != null) {
                            view.loadUrl(fallbackUrl);
                            return true;
                        }
                        try {
                            Intent marketIntent = new Intent(Intent.ACTION_VIEW);
                            marketIntent.setData(Uri.parse("market://details?id=" + intent.getPackage()));
                            startActivity(marketIntent);
                            return true;
                        } catch (ActivityNotFoundException e2) {
                            return false;
                        }
                    } catch (Exception e) {
                        return false;
                    }
                }

                if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("javascript:")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (ActivityNotFoundException e) {
                        handleAppNotInstalled(url);
                        return true;
                    }
                }

                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }

    private void handleAppNotInstalled(String url) {
        if (url.startsWith("ispmobile://")) {
            openPlayStore("kvp.jjy.MispAndroid320");
        } else if (url.startsWith("shinhan-sr-ansimclick://") || url.startsWith("smshinhanansimclick://")) {
            openPlayStore("com.shcard.smartpay");
        } else if (url.startsWith("kb-acp://")) {
            openPlayStore("com.kbcard.cxh.appcard");
        } else if (url.startsWith("hdcardappcardansimclick://")) {
            openPlayStore("com.hyundaicard.appcard");
        } else if (url.startsWith("smhyundaiansimclick://")) {
            openPlayStore("com.hyundaicard.appcard");
        } else if (url.startsWith("lotteappcard://")) {
            openPlayStore("com.lcacApp");
        } else if (url.startsWith("lottesmartpay://")) {
            openPlayStore("com.lottemembers.android");
        } else if (url.startsWith("nhappcardansimclick://") || url.startsWith("nhallonepayansimclick://")) {
            openPlayStore("nh.smart.nhallonepay");
        } else if (url.startsWith("citispay://") || url.startsWith("ciabordo://")) {
            openPlayStore("kr.co.citibank.citimobile");
        } else if (url.startsWith("cloudpay://")) {
            openPlayStore("com.hanaskcard.paycla");
        } else if (url.startsWith("hanawalletmembers://")) {
            openPlayStore("com.hanaskcard.rocomo.potal");
        } else if (url.startsWith("wooripay://") || url.startsWith("wooricard://") || url.startsWith("com.wooricard")) {
            openPlayStore("com.wooricard.smartapp");
        } else if (url.startsWith("newsmartpib://")) {
            openPlayStore("com.wooribank.smart.npib");
        } else if (url.startsWith("kftc-bankpay://")) {
            openPlayStore("com.kftc.bankpay.android");
        } else if (url.startsWith("lguthepay-xpay://") || url.startsWith("lguthepay://")) {
            openPlayStore("com.lguplus.paynow");
        } else if (url.startsWith("supertoss://")) {
            openPlayStore("viva.republica.toss");
        } else if (url.startsWith("kakaotalk://")) {
            openPlayStore("com.kakao.talk");
        } else if (url.startsWith("lpayapp://") || url.startsWith("liivbank://")) {
            openPlayStore("com.kbstar.liivbank");
        } else if (url.startsWith("naversearchapp://") || url.startsWith("naversearchthirdlogin://")) {
            openPlayStore("com.nhn.android.search");
        } else if (url.startsWith("samsungpay://")) {
            openPlayStore("com.samsung.android.spay");
        } else if (url.startsWith("scardcertiapp://")) {
            openPlayStore("com.samsungcard.smartpay");
        }
    }

    private void openPlayStore(String packageName) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + packageName));
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + packageName));
            startActivity(intent);
        }
    }

    public static class ImmersiveBridge {
        private static final String TAG = "ImmersiveBridge";
        private final MainActivity activity;

        ImmersiveBridge(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void enter() {
            Log.i(TAG, "enter() called from JS");
            activity.runOnUiThread(() -> {
                Window window = activity.getWindow();
                if (window == null) {
                    Log.w(TAG, "enter: window is null");
                    return;
                }
                WindowCompat.setDecorFitsSystemWindows(window, false);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    WindowInsetsController controller = window.getInsetsController();
                    if (controller == null) {
                        Log.w(TAG, "enter: insetsController null, falling back to legacy flags");
                        applyLegacyImmersive(window);
                    } else {
                        controller.setSystemBarsBehavior(
                            WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                        );
                        controller.hide(
                            WindowInsets.Type.navigationBars() | WindowInsets.Type.statusBars()
                        );
                        Log.i(TAG, "enter: insetsController.hide invoked (API 30+)");
                    }
                } else {
                    applyLegacyImmersive(window);
                    Log.i(TAG, "enter: legacy systemUiVisibility applied (API < 30)");
                }
            });
        }

        @JavascriptInterface
        public void exit() {
            Log.i(TAG, "exit() called from JS");
            activity.runOnUiThread(() -> {
                Window window = activity.getWindow();
                if (window == null) {
                    Log.w(TAG, "exit: window is null");
                    return;
                }
                WindowCompat.setDecorFitsSystemWindows(window, true);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    WindowInsetsController controller = window.getInsetsController();
                    if (controller != null) {
                        controller.show(
                            WindowInsets.Type.navigationBars() | WindowInsets.Type.statusBars()
                        );
                    }
                    window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                } else {
                    View decor = window.getDecorView();
                    decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
                    window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                }
            });
        }

        private void applyLegacyImmersive(Window window) {
            window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            View decor = window.getDecorView();
            decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
            );
        }

        @JavascriptInterface
        public boolean isAvailable() {
            return true;
        }
    }
}
