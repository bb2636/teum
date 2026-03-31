package com.teum.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import java.util.Arrays;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        RequestConfiguration configuration = new RequestConfiguration.Builder()
            .setTestDeviceIds(Arrays.asList("cf83971a-13f6-4dc2-82fd-bc11e897882d"))
            .build();
        MobileAds.setRequestConfiguration(configuration);
        MobileAds.initialize(this, initializationStatus -> {});

        getBridge().getWebView().setWebViewClient(new WebViewClient() {
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
                        } else if (url.startsWith("wooripay://")) {
                            openPlayStore("com.wooricard.smartapp");
                        } else if (url.startsWith("com.wooricard.wcard://")) {
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
                        return true;
                    }
                }

                return super.shouldOverrideUrlLoading(view, request);
            }
        });
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
