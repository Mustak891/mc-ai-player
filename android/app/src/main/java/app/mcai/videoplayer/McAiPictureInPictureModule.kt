package app.mcai.videoplayer

import android.app.AppOpsManager
import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Rational
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class McAiPictureInPictureModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  init {
    setReactContext(reactContext)
  }

  override fun getName(): String = "McAiPictureInPicture"

  @ReactMethod
  fun isSupported(promise: Promise) {
    promise.resolve(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
  }

  @ReactMethod
  fun setAutoEnterEnabled(enabled: Boolean, promise: Promise) {
    PictureInPictureController.autoEnterEnabled = enabled
    promise.resolve(null)
  }

  @ReactMethod
  fun isPermissionEnabled(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(false)
      return
    }
    try {
      val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(
          AppOpsManager.OPSTR_PICTURE_IN_PICTURE,
          Process.myUid(),
          reactApplicationContext.packageName
        )
      } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(
          AppOpsManager.OPSTR_PICTURE_IN_PICTURE,
          Process.myUid(),
          reactApplicationContext.packageName
        )
      }
      promise.resolve(mode == AppOpsManager.MODE_ALLOWED || mode == AppOpsManager.MODE_DEFAULT)
    } catch (_: Exception) {
      // OEM behavior differs; default to true so we do not block entry.
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun enter(aspectRatioWidth: Int, aspectRatioHeight: Int, isPlaying: Boolean, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("PIP_NO_ACTIVITY", "Current activity is null")
      return
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.reject("PIP_UNSUPPORTED", "PiP requires Android 8.0+")
      return
    }
    activity.runOnUiThread {
      try {
        val width = aspectRatioWidth.coerceIn(1, 4096)
        val height = aspectRatioHeight.coerceIn(1, 4096)
        val params = buildPipParams(width, height, isPlaying)
        val entered = activity.enterPictureInPictureMode(params)
        if (entered) {
          promise.resolve(null)
          return@runOnUiThread
        }
        promise.reject("PIP_ENTER_FAILED", "PiP enter returned false")
      } catch (error: Exception) {
        promise.reject("PIP_ENTER_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun updateActions(isPlaying: Boolean, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(null)
      return
    }
    activity.runOnUiThread {
      try {
        val params = PictureInPictureParams.Builder()
          .setActions(buildActions(isPlaying))
          .let { builder ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
              builder.setSeamlessResizeEnabled(true)
            }
            builder
          }
          .build()
        activity.setPictureInPictureParams(params)
        promise.resolve(null)
      } catch (error: Exception) {
        promise.reject("PIP_UPDATE_ACTIONS_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun openSettings(promise: Promise) {
    try {
      val packageUri = Uri.parse("package:${reactApplicationContext.packageName}")
      val fallbackIntents = listOf(
        Intent("android.settings.PICTURE_IN_PICTURE_SETTINGS").apply {
          data = packageUri
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        },
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = packageUri
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        },
        Intent(Settings.ACTION_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
      )

      val intentToLaunch = fallbackIntents.firstOrNull { intent ->
        intent.resolveActivity(reactApplicationContext.packageManager) != null
      }
      if (intentToLaunch == null) {
        promise.reject("PIP_OPEN_SETTINGS_FAILED", "No settings activity available")
        return
      }
      reactApplicationContext.startActivity(intentToLaunch)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("PIP_OPEN_SETTINGS_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun bringAppToFront(promise: Promise) {
    try {
      val launch = reactApplicationContext.packageManager
        .getLaunchIntentForPackage(reactApplicationContext.packageName)
      if (launch == null) {
        promise.reject("PIP_BRING_FRONT_FAILED", "Launch intent not found")
        return
      }
      launch.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
          Intent.FLAG_ACTIVITY_SINGLE_TOP
      )
      reactApplicationContext.startActivity(launch)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("PIP_BRING_FRONT_FAILED", error.message, error)
    }
  }

  private fun buildActions(isPlaying: Boolean): List<android.app.RemoteAction> {
    return listOf(
      remoteAction(
        PictureInPictureController.ACTION_BACKWARD,
        android.R.drawable.ic_media_rew,
        "Back 10s"
      ),
      remoteAction(
        PictureInPictureController.ACTION_PLAY_PAUSE,
        if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
        if (isPlaying) "Pause" else "Play"
      ),
      remoteAction(
        PictureInPictureController.ACTION_FORWARD,
        android.R.drawable.ic_media_ff,
        "Forward 10s"
      )
    )
  }

  private fun buildPipParams(aspectRatioWidth: Int, aspectRatioHeight: Int, isPlaying: Boolean): PictureInPictureParams {
    val builder = PictureInPictureParams.Builder()
      .setAspectRatio(Rational(aspectRatioWidth, aspectRatioHeight))
      .setActions(buildActions(isPlaying))
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setSeamlessResizeEnabled(true)
    }
    return builder.build()
  }

  private fun remoteAction(action: String, iconRes: Int, title: String): android.app.RemoteAction {
    val intent = Intent(action).setPackage(reactApplicationContext.packageName)
    val pendingIntent = PendingIntent.getBroadcast(
      reactApplicationContext,
      action.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    return android.app.RemoteAction(
      Icon.createWithResource(reactApplicationContext, iconRes),
      title,
      title,
      pendingIntent
    )
  }

  override fun invalidate() {
    if (reactAppContextRef === reactContext) {
      setReactContext(null)
    }
    super.invalidate()
  }

  companion object {
    const val EVENT_NAME = "McAiPiPAction"

    @Volatile
    private var reactAppContextRef: ReactApplicationContext? = null

    internal fun setReactContext(context: ReactApplicationContext?) {
      reactAppContextRef = context
    }

    internal fun emitPiPAction(action: String) {
      val ctx = reactAppContextRef ?: return
      UiThreadUtil.runOnUiThread {
        try {
          ctx
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_NAME, action)
        } catch (_: Throwable) {
        }
      }
    }
  }
}
