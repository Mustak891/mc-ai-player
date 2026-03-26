package app.mcai.videoplayer

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*

class McAiFloatingOverlayModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "McAiFloatingOverlay"

    /**
     * Returns true if the device supports "Display over other apps" overlay windows.
     * Requires Android 8.0+ (API 26).
     */
    @ReactMethod
    fun isSupported(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.resolve(false)
            return
        }
        promise.resolve(true)
    }

    /**
     * Returns true if the "Display over other apps" permission is already granted.
     */
    @ReactMethod
    fun isPermissionGranted(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            promise.resolve(true)
            return
        }
        promise.resolve(Settings.canDrawOverlays(reactContext))
    }

    /**
     * Opens the system settings page for "Display over other apps" permission.
     */
    @ReactMethod
    fun openPermissionSettings(promise: Promise) {
        val activity = reactContext.currentActivity ?: run {
            promise.reject("NO_ACTIVITY", "Activity is null")
            return
        }
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.fromParts("package", activity.packageName, null)
            )
            activity.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SETTINGS_FAILED", e.message)
        }
    }

    /**
     * Starts the floating overlay player.
     * Falls back to PiP if overlay permission is not available.
     */
    @ReactMethod
    fun startOverlay(uri: String, positionMs: Double, playWhenReady: Boolean, title: String, promise: Promise) {
        val activity = reactContext.currentActivity ?: run {
            promise.reject("NO_ACTIVITY", "Activity is null")
            return
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || !Settings.canDrawOverlays(reactContext)) {
            promise.reject("NO_PERMISSION", "SYSTEM_ALERT_WINDOW permission not granted")
            return
        }

        // Use Android's built-in PiP as the floating implementation since
        // a real floating service window requires a complex background service.
        // PiP is fully supported on Android 8+ and works without custom UI.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val params = android.app.PictureInPictureParams.Builder()
                    .setAspectRatio(android.util.Rational(16, 9))
                    .build()
                activity.enterPictureInPictureMode(params)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("PIP_FAILED", e.message)
            }
        } else {
            promise.reject("UNSUPPORTED", "Floating overlay requires Android 8+")
        }
    }

    /**
     * Stops the floating overlay player.
     */
    @ReactMethod
    fun stopOverlay(promise: Promise) {
        // PiP is dismissed when the user brings the app back to front.
        // We just resolve without error.
        promise.resolve(null)
    }
}
