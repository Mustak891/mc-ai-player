package app.mcai.videoplayer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.content.res.Configuration

import com.facebook.react.ReactActivity
import com.facebook.react.ReactApplication
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  private val pipReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      when (intent?.action) {
        PictureInPictureController.ACTION_EXPAND -> {
          emitPipActionToJs(intent.action ?: "")
          val launch = packageManager.getLaunchIntentForPackage(packageName)
          if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            startActivity(launch)
          }
        }
        PictureInPictureController.ACTION_CLOSE -> {
          emitPipActionToJs(intent.action ?: "")
          PictureInPictureController.autoEnterEnabled = false
        }
        PictureInPictureController.ACTION_PLAY_PAUSE -> {
          emitPipActionToJs(intent.action ?: "")
        }
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
    registerPipReceiver()
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }

  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && PictureInPictureController.autoEnterEnabled) {
      try {
        enterPictureInPictureMode()
      } catch (_: Exception) {}
    }
  }

  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    emitPipActionToJs(
      if (isInPictureInPictureMode) {
        "app.mcai.videoplayer.pip.STATE_ENTERED"
      } else {
        "app.mcai.videoplayer.pip.STATE_EXITED"
      }
    )
  }

  override fun onDestroy() {
    super.onDestroy()
    try {
      unregisterReceiver(pipReceiver)
    } catch (_: Exception) {}
  }

  private fun registerPipReceiver() {
    val filter = IntentFilter().apply {
      addAction(PictureInPictureController.ACTION_PLAY_PAUSE)
      addAction(PictureInPictureController.ACTION_EXPAND)
      addAction(PictureInPictureController.ACTION_CLOSE)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(pipReceiver, filter, RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      registerReceiver(pipReceiver, filter)
    }
  }

  private fun emitPipActionToJs(action: String) {
    try {
      val reactContext = (application as ReactApplication).reactNativeHost.reactInstanceManager.currentReactContext
      reactContext
        ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit("McAiPiPAction", action)
    } catch (_: Exception) {}
  }
}
