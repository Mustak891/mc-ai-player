package app.mcai.videoplayer

import android.app.PictureInPictureParams
import android.app.PendingIntent
import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.os.Process
import android.util.Rational
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class McAiPictureInPictureModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "McAiPictureInPicture"

  @ReactMethod
  fun isSupported(promise: Promise) {
    val hasFeature = reactApplicationContext.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
    promise.resolve(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && hasFeature)
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
      // If OEM API behavior is inconsistent, don't block the user on detection.
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
      } catch (e: Exception) {
        promise.reject("PIP_ENTER_FAILED", e.message, e)
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
      } catch (e: Exception) {
        promise.reject("PIP_UPDATE_ACTIONS_FAILED", e.message, e)
      }
    }
  }

  @ReactMethod
  fun openSettings(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("PIP_NO_ACTIVITY", "Current activity is null")
      return
    }
    activity.runOnUiThread {
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          val intent = Intent("android.settings.PICTURE_IN_PICTURE_SETTINGS").apply {
            data = Uri.parse("package:${activity.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          activity.startActivity(intent)
        } else {
          val intent = Intent("android.settings.APPLICATION_DETAILS_SETTINGS").apply {
            data = Uri.parse("package:${activity.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          activity.startActivity(intent)
        }
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("PIP_OPEN_SETTINGS_FAILED", e.message, e)
      }
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
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      reactApplicationContext.startActivity(launch)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("PIP_BRING_FRONT_FAILED", e.message, e)
    }
  }

  private fun buildActions(isPlaying: Boolean): List<android.app.RemoteAction> {
    return listOf(
      remoteAction(
        PictureInPictureController.ACTION_PLAY_PAUSE,
        if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
        if (isPlaying) "Pause" else "Play"
      ),
      remoteAction(
        PictureInPictureController.ACTION_EXPAND,
        android.R.drawable.ic_menu_view,
        "Maximize"
      ),
      remoteAction(
        PictureInPictureController.ACTION_CLOSE,
        android.R.drawable.ic_menu_close_clear_cancel,
        "Close"
      ),
    )
  }

  private fun buildPipParams(
    aspectRatioWidth: Int,
    aspectRatioHeight: Int,
    isPlaying: Boolean
  ): PictureInPictureParams {
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
}
