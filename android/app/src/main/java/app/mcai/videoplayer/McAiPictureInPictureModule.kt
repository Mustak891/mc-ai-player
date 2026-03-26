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

    private val pipReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
            if (intent == null || intent.action != "MEDIA_CONTROL") return
            val controlType = intent.getIntExtra("control_type", 0)
            val eventName = when (controlType) {
                1 -> "app.mcai.videoplayer.pip.PLAY_PAUSE"
                2 -> "app.mcai.videoplayer.pip.FORWARD"
                3 -> "app.mcai.videoplayer.pip.BACKWARD"
                else -> return
            }
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("McAiPiPAction", eventName)
        }
    }

    init {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val filter = android.content.IntentFilter("MEDIA_CONTROL")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reactContext.registerReceiver(pipReceiver, filter, android.content.Context.RECEIVER_NOT_EXPORTED)
            } else {
                reactContext.registerReceiver(pipReceiver, filter)
            }
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                reactContext.unregisterReceiver(pipReceiver)
            } catch (e: Exception) {}
        }
    }

    override fun getName(): String = "McAiPictureInPicture"

    private fun getPipActions(isPlaying: Boolean): ArrayList<RemoteAction> {
        val actions = ArrayList<RemoteAction>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intentBack = Intent("MEDIA_CONTROL").putExtra("control_type", 3)
            val pendingBack = android.app.PendingIntent.getBroadcast(reactContext, 3, intentBack, android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE)
            val iconBack = Icon.createWithResource(reactContext, android.R.drawable.ic_media_rew)
            actions.add(RemoteAction(iconBack, "Rewind", "Rewind 10s", pendingBack))

            val intentPlay = Intent("MEDIA_CONTROL").putExtra("control_type", 1)
            val pendingPlay = android.app.PendingIntent.getBroadcast(reactContext, 1, intentPlay, android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE)
            val iconPlayRes = if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
            val iconPlay = Icon.createWithResource(reactContext, iconPlayRes)
            actions.add(RemoteAction(iconPlay, if (isPlaying) "Pause" else "Play", if (isPlaying) "Pause" else "Play", pendingPlay))

            val intentForward = Intent("MEDIA_CONTROL").putExtra("control_type", 2)
            val pendingForward = android.app.PendingIntent.getBroadcast(reactContext, 2, intentForward, android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE)
            val iconForward = Icon.createWithResource(reactContext, android.R.drawable.ic_media_ff)
            actions.add(RemoteAction(iconForward, "Forward", "Forward 10s", pendingForward))
        }
        return actions
    }

    @ReactMethod
    fun isSupported(promise: Promise) {
        val activity = reactContext.currentActivity
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity == null) {
            promise.resolve(false)
            return
        }
        promise.resolve(activity.packageManager.hasSystemFeature("android.software.picture_in_picture"))
    }

    @ReactMethod
    fun isPermissionEnabled(promise: Promise) {
        val activity = reactContext.currentActivity ?: run {
            promise.resolve(false)
            return
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.resolve(false)
            return
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun setAutoEnterEnabled(enabled: Boolean, promise: Promise) {
        val activity = reactContext.currentActivity ?: run { promise.resolve(null); return }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                val params = PictureInPictureParams.Builder()
                    .setAutoEnterEnabled(enabled)
                    .build()
                activity.setPictureInPictureParams(params)
            } catch (e: Exception) {}
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun enter(width: Int, height: Int, isPlaying: Boolean, promise: Promise) {
        val activity = reactContext.currentActivity ?: run {
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
                .setActions(getPipActions(isPlaying))
                .build()
            activity.enterPictureInPictureMode(params)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("PIP_ENTER_FAILED", e.message ?: "Unknown error")
        }
    }

    @ReactMethod
    fun updateActions(isPlaying: Boolean, promise: Promise) {
        val activity = reactContext.currentActivity ?: run { promise.resolve(null); return }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.resolve(null)
            return
        }
        try {
            val params = PictureInPictureParams.Builder()
                .setActions(getPipActions(isPlaying))
                .build()
            activity.setPictureInPictureParams(params)
        } catch (e: Exception) {}
        promise.resolve(null)
    }

    @ReactMethod
    fun openSettings(promise: Promise) {
        val activity = reactContext.currentActivity ?: run {
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
        val activity = reactContext.currentActivity ?: run { promise.resolve(null); return }
        try {
            val intent = Intent(reactContext, activity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            activity.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }
}
