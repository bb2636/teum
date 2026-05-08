# =====================================================================
# TEUM ProGuard / R8 Rules
# =====================================================================
# 난독화된 빌드의 스택트레이스 복원을 위해 라인 정보 보존
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ---------------------------------------------------------------------
# Capacitor & WebView
# ---------------------------------------------------------------------
# Capacitor 플러그인은 리플렉션으로 호출되므로 모두 보존
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public *;
    @com.getcapacitor.annotation.PluginMethod public *;
}

# Cordova 호환 플러그인
-keep class org.apache.cordova.** { *; }

# WebView JavaScript 인터페이스
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ---------------------------------------------------------------------
# Capacitor 서드파티 플러그인 (AdMob, Camera, Push 등)
# ---------------------------------------------------------------------
-keep class com.getcapacitor.community.admob.** { *; }
-keep class com.capacitorjs.plugins.** { *; }

# ---------------------------------------------------------------------
# Google AdMob / Play Services
# ---------------------------------------------------------------------
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
-keep class com.google.ads.** { *; }
-dontwarn com.google.ads.**

# ---------------------------------------------------------------------
# Firebase (FCM)
# ---------------------------------------------------------------------
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# ---------------------------------------------------------------------
# AndroidX & 기타
# ---------------------------------------------------------------------
-keep class androidx.** { *; }
-dontwarn androidx.**

# Gson/Json 모델 (Capacitor 내부 사용)
-keepclassmembers,allowobfuscation class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Enum
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Parcelable
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}
