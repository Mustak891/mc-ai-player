package app.mcai.videoplayer

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.app.Activity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.modules.core.DeviceEventManagerModule

class McAiFloatingOverlayModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  init {
    setReactContext(reactContext)
  }

  override fun getName(): String = "McAiFloatingOverlay"

  @ReactMethod
  fun isSupported(promise: Promise) {
    promise.resolve(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
  }

  @ReactMethod
  fun isPermissionGranted(promise: Promise) {
    val granted = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      true
    } else {
      Settings.canDrawOverlays(reactContext)
    }
    promise.resolve(granted)
  }

  @ReactMethod
  fun openPermissionSettings(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${reactContext.packageName}")
        ).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(intent)
      }
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("E_OPEN_OVERLAY_SETTINGS", error.message, error)
    }
  }

  @ReactMethod
  fun startOverlay(uri: String, positionMs: Double, playWhenReady: Boolean, title: String?, promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        promise.reject("E_UNSUPPORTED", "Overlay requires Android 8+")
        return
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
        promise.reject("E_PERMISSION_DENIED", "Display over other apps permission is not granted")
        return
      }
      val intent = Intent(reactContext, McAiFloatingOverlayService::class.java).apply {
        action = McAiFloatingOverlayService.ACTION_START
        putExtra(McAiFloatingOverlayService.EXTRA_URI, uri)
        putExtra(McAiFloatingOverlayService.EXTRA_POSITION_MS, positionMs.toLong())
        putExtra(McAiFloatingOverlayService.EXTRA_PLAY_WHEN_READY, playWhenReady)
        putExtra(McAiFloatingOverlayService.EXTRA_TITLE, title)
      }
      reactContext.startService(intent)
      minimizeAppTask()
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("E_START_OVERLAY", error.message, error)
    }
  }

  @ReactMethod
  fun stopOverlay(promise: Promise) {
    try {
      val intent = Intent(reactContext, McAiFloatingOverlayService::class.java).apply {
        action = McAiFloatingOverlayService.ACTION_STOP
      }
      reactContext.startService(intent)
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("E_STOP_OVERLAY", error.message, error)
    }
  }

  private fun minimizeAppTask() {
    UiThreadUtil.runOnUiThread {
      try {
        val activity = reactContext.currentActivity as? Activity
        if (activity != null) {
          activity.moveTaskToBack(true)
          return@runOnUiThread
        }
        val homeIntent = Intent(Intent.ACTION_MAIN).apply {
          addCategory(Intent.CATEGORY_HOME)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(homeIntent)
      } catch (_: Throwable) {
      }
    }
  }

  override fun invalidate() {
    if (reactAppContextRef === reactContext) {
      setReactContext(null)
    }
    super.invalidate()
  }

  companion object {
    const val EVENT_NAME = "McAiOverlayAction"
    const val ACTION_EXPAND = "app.mcai.videoplayer.overlay.EXPAND"
    const val ACTION_SETTINGS = "app.mcai.videoplayer.overlay.SETTINGS"
    const val ACTION_CLOSE = "app.mcai.videoplayer.overlay.CLOSE"

    @Volatile
    private var reactAppContextRef: ReactApplicationContext? = null

    internal fun setReactContext(context: ReactApplicationContext?) {
      reactAppContextRef = context
    }

    internal fun emitOverlayAction(action: String, positionMs: Long, wasPlaying: Boolean) {
      val ctx = reactAppContextRef ?: return
      val payload = Arguments.createMap().apply {
        putString("action", action)
        putDouble("positionMs", positionMs.toDouble())
        putBoolean("wasPlaying", wasPlaying)
      }
      UiThreadUtil.runOnUiThread {
        try {
          ctx
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_NAME, payload)
        } catch (_: Throwable) {
        }
      }
    }
  }
}
