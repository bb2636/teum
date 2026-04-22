package com.teum.app1;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.community.admob.AdMob;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AdMob.class);
        super.onCreate(savedInstanceState);

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
}
