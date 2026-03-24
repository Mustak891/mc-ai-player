package app.mcai.videoplayer

import android.app.Activity
import android.app.PictureInPictureParams
import android.app.RemoteAction
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.util.Rational
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class McAiPictureInPictureModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "McAiPictureInPicture"

    @ReactMethod
    fun isSupported(promise: Promise) {
        val activity = currentActivity
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity == null) {
            promise.resolve(false)
            return
        }
        promise.resolve(activity.packageManager.hasSystemFeature("android.software.picture_in_picture"))
    }

    @ReactMethod
    fun isPermissionEnabled(promise: Promise) {
        val activity = currentActivity ?: run {
            promise.resolve(false)
            return
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.resolve(false)
            return
        }
        // On Android 12+ we can check directly. On older, just try to enter and see.
        promise.resolve(true)
    }

    @ReactMethod
    fun setAutoEnterEnabled(enabled: Boolean, promise: Promise) {
        val activity = currentActivity ?: run { promise.resolve(null); return }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                val params = PictureInPictureParams.Builder()
                    .setAutoEnterEnabled(enabled)
                    .build()
                activity.setPictureInPictureParams(params)
            } catch (e: Exception) {
                // ignore
            }
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun enter(width: Int, height: Int, isPlaying: Boolean, promise: Promise) {
        val activity = currentActivity ?: run {
            promise.reject("NO_ACTIVITY", "Activity is null")
            return
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.reject("UNSUPPORTED", "PiP requires Android 8+")
            return
        }
        try {
            val rational = Rational(width.coerceAtLeast(1), height.coerceAtLeast(1))
            val params = PictureInPictureParams.Builder()
                .setAspectRatio(rational)
                .build()
            activity.enterPictureInPictureMode(params)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("PIP_ENTER_FAILED", e.message ?: "Unknown error")
        }
    }

    @ReactMethod
    fun updateActions(isPlaying: Boolean, promise: Promise) {
        val activity = currentActivity ?: run { promise.resolve(null); return }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.resolve(null)
            return
        }
        try {
            val params = PictureInPictureParams.Builder().build()
            activity.setPictureInPictureParams(params)
        } catch (e: Exception) {
            // ignore
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun openSettings(promise: Promise) {
        val activity = currentActivity ?: run {
            promise.reject("NO_ACTIVITY", "Activity is null")
            return
        }
        try {
            val intent = Intent("android.settings.PICTURE_IN_PICTURE_SETTINGS").apply {
                data = android.net.Uri.fromParts("package", activity.packageName, null)
            }
            activity.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            // Fallback to app settings
            val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = android.net.Uri.fromParts("package", activity.packageName, null)
            }
            try {
                activity.startActivity(intent)
                promise.resolve(null)
            } catch (e2: Exception) {
                promise.reject("SETTINGS_OPEN_FAILED", e2.message)
            }
        }
    }

    @ReactMethod
    fun bringAppToFront(promise: Promise) {
        val activity = currentActivity ?: run { promise.resolve(null); return }
        try {
            val intent = Intent(reactContext, activity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            }
            activity.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }
}
