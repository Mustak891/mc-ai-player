package app.mcai.videoplayer

import expo.modules.splashscreen.SplashScreenManager

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.content.res.Configuration
import android.provider.Settings

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  private val pipReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      when (intent?.action) {
        PictureInPictureController.ACTION_BACKWARD -> {
          emitPipActionToJs(PictureInPictureController.ACTION_BACKWARD)
        }

        PictureInPictureController.ACTION_PLAY_PAUSE -> {
          emitPipActionToJs(PictureInPictureController.ACTION_PLAY_PAUSE)
        }

        PictureInPictureController.ACTION_FORWARD -> {
          emitPipActionToJs(PictureInPictureController.ACTION_FORWARD)
        }

        PictureInPictureController.ACTION_SETTINGS -> {
          openPictureInPictureSettings()
        }

        PictureInPictureController.ACTION_CLOSE -> {
          emitPipActionToJs(PictureInPictureController.ACTION_CLOSE)
          PictureInPictureController.autoEnterEnabled = false
        }

        PictureInPictureController.ACTION_EXPAND -> {
          emitPipActionToJs(PictureInPictureController.ACTION_EXPAND)
          bringTaskToFront()
        }
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
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

  override fun onPictureInPictureModeChanged(
    isInPictureInPictureMode: Boolean,
    newConfig: Configuration
  ) {
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
    try {
      unregisterReceiver(pipReceiver)
    } catch (_: Exception) {}
    super.onDestroy()
  }

  private fun registerPipReceiver() {
    val filter = IntentFilter().apply {
      addAction(PictureInPictureController.ACTION_BACKWARD)
      addAction(PictureInPictureController.ACTION_PLAY_PAUSE)
      addAction(PictureInPictureController.ACTION_FORWARD)
      addAction(PictureInPictureController.ACTION_SETTINGS)
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

  private fun bringTaskToFront() {
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    if (launch != null) {
      launch.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      startActivity(launch)
    }
  }

  private fun openPictureInPictureSettings() {
    try {
      val packageUri = Uri.parse("package:$packageName")
      val intents = listOf(
        Intent("android.settings.PICTURE_IN_PICTURE_SETTINGS").apply {
          data = packageUri
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        },
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = packageUri
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        },
      )

      val launchIntent = intents.firstOrNull { intent ->
        intent.resolveActivity(packageManager) != null
      } ?: return

      startActivity(launchIntent)
    } catch (_: Exception) {}
  }

  private fun emitPipActionToJs(action: String) {
    McAiPictureInPictureModule.emitPiPAction(action)
  }
}
