package app.mcai.videoplayer

import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlin.math.roundToInt

class McAiEqualizerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private var equalizer: Equalizer? = null
  private var loudnessEnhancer: LoudnessEnhancer? = null
  private var attachedSessionId: Int = -1

  override fun getName(): String = "McAiEqualizer"

  @ReactMethod
  fun isSupported(promise: Promise) {
    promise.resolve(true)
  }

  @ReactMethod
  fun attachToPlayerSession(sessionId: Int, promise: Promise) {
    try {
      val normalizedSessionId = if (sessionId <= 0) 0 else sessionId
      if (attachedSessionId == normalizedSessionId && equalizer != null) {
        promise.resolve(null)
        return
      }
      releaseInternal()
      equalizer = Equalizer(0, normalizedSessionId).apply {
        enabled = true
      }
      loudnessEnhancer = LoudnessEnhancer(normalizedSessionId).apply {
        enabled = true
      }
      attachedSessionId = normalizedSessionId
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("EQ_ATTACH_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun setEnabled(enabled: Boolean, promise: Promise) {
    try {
      equalizer?.enabled = enabled
      loudnessEnhancer?.enabled = enabled
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("EQ_ENABLE_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun setPreampDb(value: Double, promise: Promise) {
    try {
      val targetGainMb = ((value.coerceIn(-20.0, 20.0)).coerceAtLeast(0.0) * 100.0).roundToInt()
      loudnessEnhancer?.setTargetGain(targetGainMb)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("EQ_PREAMP_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun setBandGainDb(index: Int, value: Double, promise: Promise) {
    try {
      val eq = equalizer
      if (eq == null) {
        promise.resolve(null)
        return
      }
      val band = index.coerceIn(0, eq.numberOfBands.toInt() - 1)
      val valueMb = (value.coerceIn(-20.0, 20.0) * 100.0).roundToInt()
      val range = eq.bandLevelRange
      val clamped = valueMb.coerceIn(range[0].toInt(), range[1].toInt()).toShort()
      eq.setBandLevel(band.toShort(), clamped)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("EQ_BAND_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun reset(promise: Promise) {
    try {
      val eq = equalizer
      if (eq != null) {
        val count = eq.numberOfBands.toInt()
        for (i in 0 until count) {
          eq.setBandLevel(i.toShort(), 0.toShort())
        }
      }
      loudnessEnhancer?.setTargetGain(0)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("EQ_RESET_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun release(promise: Promise) {
    try {
      releaseInternal()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("EQ_RELEASE_FAILED", e.message, e)
    }
  }

  override fun invalidate() {
    releaseInternal()
    super.invalidate()
  }

  private fun releaseInternal() {
    try {
      equalizer?.release()
    } catch (_: Exception) {}
    try {
      loudnessEnhancer?.release()
    } catch (_: Exception) {}
    equalizer = null
    loudnessEnhancer = null
    attachedSessionId = -1
  }
}
