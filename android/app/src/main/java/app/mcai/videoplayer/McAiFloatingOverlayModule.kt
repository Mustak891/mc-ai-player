package app.mcai.videoplayer

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class McAiFloatingOverlayModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  init {
    reactContextRef = reactContext
  }

  override fun getName(): String = "McAiFloatingOverlay"

  @ReactMethod
  fun isSupported(promise: Promise) {
    promise.resolve(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
  }

  @ReactMethod
  fun isPermissionGranted(promise: Promise) {
    promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
  }

  @ReactMethod
  fun openPermissionSettings(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("OVERLAY_NO_ACTIVITY", "Current activity is null")
      return
    }
    try {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${reactApplicationContext.packageName}")
      ).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactApplicationContext.startActivity(intent)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("OVERLAY_OPEN_SETTINGS_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun startOverlay(uri: String, positionMs: Double, playWhenReady: Boolean, title: String?, promise: Promise) {
    if (!Settings.canDrawOverlays(reactApplicationContext)) {
      promise.reject("OVERLAY_PERMISSION_REQUIRED", "Draw over apps permission is required")
      return
    }
    try {
      val intent = Intent(reactApplicationContext, FloatingPlayerService::class.java).apply {
        action = FloatingOverlayController.ACTION_START
        putExtra(FloatingOverlayController.EXTRA_URI, uri)
        putExtra(FloatingOverlayController.EXTRA_POSITION_MS, positionMs.toLong())
        putExtra(FloatingOverlayController.EXTRA_PLAY_WHEN_READY, playWhenReady)
        putExtra(FloatingOverlayController.EXTRA_TITLE, title ?: "MC AI Player")
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactApplicationContext.startForegroundService(intent)
      } else {
        reactApplicationContext.startService(intent)
      }
      reactApplicationContext.currentActivity?.moveTaskToBack(true)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("OVERLAY_START_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun stopOverlay(promise: Promise) {
    try {
      val intent = Intent(reactApplicationContext, FloatingPlayerService::class.java).apply {
        action = FloatingOverlayController.ACTION_STOP
      }
      reactApplicationContext.startService(intent)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("OVERLAY_STOP_FAILED", e.message, e)
    }
  }

  companion object {
    private var reactContextRef: ReactApplicationContext? = null

    fun emitOverlayEvent(action: String, positionMs: Long) {
      val reactContext = reactContextRef ?: return
      if (!reactContext.hasActiveReactInstance()) return
      val payload = Arguments.createMap().apply {
        putString("action", action)
        putDouble("positionMs", positionMs.toDouble())
      }
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(FloatingOverlayController.EVENT_ACTION, payload)
    }
  }
}
