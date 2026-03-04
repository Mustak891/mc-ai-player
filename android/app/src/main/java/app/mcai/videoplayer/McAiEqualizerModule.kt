package app.mcai.videoplayer

import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlin.math.roundToInt

class McAiEqualizerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val lock = Any()
  private var audioSessionId: Int = 0
  private var enabled = false
  private var preampDb = 0f
  private val bandGainsDb = mutableMapOf<Int, Float>()
  private var equalizer: Equalizer? = null
  private var loudnessEnhancer: LoudnessEnhancer? = null

  override fun getName(): String = "McAiEqualizer"

  @ReactMethod
  fun isSupported(promise: Promise) {
    promise.resolve(Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT)
  }

  @ReactMethod
  fun attachToPlayerSession(sessionId: Int, promise: Promise) {
    try {
      synchronized(lock) {
        attachInternal(sessionId)
      }
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("E_ATTACH_SESSION", error.message, error)
    }
  }

  @ReactMethod
  fun setEnabled(value: Boolean, promise: Promise) {
    try {
      synchronized(lock) {
        enabled = value
        equalizer?.enabled = value
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
          loudnessEnhancer?.enabled = value
        }
      }
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("E_SET_ENABLED", error.message, error)
    }
  }

  @ReactMethod
  fun setPreampDb(value: Double, promise: Promise) {
    try {
      synchronized(lock) {
        preampDb = clampDb(value.toFloat())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
          loudnessEnhancer?.setTargetGain((preampDb * 100f).roundToInt())
          if (enabled) {
            loudnessEnhancer?.enabled = true
          }
        }
      }
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("E_SET_PREAMP", error.message, error)
    }
  }

  @ReactMethod
  fun setBandGainDb(index: Int, value: Double, promise: Promise) {
    try {
      synchronized(lock) {
        val clampedDb = clampDb(value.toFloat())
        bandGainsDb[index] = clampedDb
        applyBandGain(index, clampedDb)
      }
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("E_SET_BAND", error.message, error)
    }
  }

  @ReactMethod
  fun reset(promise: Promise) {
    try {
      synchronized(lock) {
        preampDb = 0f
        bandGainsDb.clear()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
          loudnessEnhancer?.setTargetGain(0)
        }
        equalizer?.let { eq ->
          val bands = eq.numberOfBands.toInt()
          for (band in 0 until bands) {
            applyBandGain(band, 0f)
          }
        }
      }
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("E_RESET", error.message, error)
    }
  }

  @ReactMethod
  fun release(promise: Promise) {
    try {
      synchronized(lock) {
        releaseInternal()
      }
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("E_RELEASE", error.message, error)
    }
  }

  override fun invalidate() {
    synchronized(lock) {
      releaseInternal()
    }
    super.invalidate()
  }

  private fun attachInternal(sessionId: Int) {
    if (audioSessionId == sessionId && (equalizer != null || loudnessEnhancer != null)) {
      return
    }

    releaseInternal()
    audioSessionId = sessionId
    val targetSession = if (sessionId > 0) sessionId else 0

    equalizer = try {
      Equalizer(0, targetSession).apply {
        enabled = this@McAiEqualizerModule.enabled
      }
    } catch (_: Throwable) {
      null
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
      loudnessEnhancer = try {
        LoudnessEnhancer(targetSession).apply {
          setTargetGain((preampDb * 100f).roundToInt())
          enabled = this@McAiEqualizerModule.enabled
        }
      } catch (_: Throwable) {
        null
      }
    }

    bandGainsDb.forEach { (index, db) ->
      applyBandGain(index, db)
    }
  }

  private fun applyBandGain(index: Int, db: Float) {
    val eq = equalizer ?: return
    val bandCount = eq.numberOfBands.toInt()
    if (index < 0 || index >= bandCount) {
      return
    }
    val range = eq.bandLevelRange
    val minLevel = range[0].toInt()
    val maxLevel = range[1].toInt()
    val level = (db * 100f).roundToInt().coerceIn(minLevel, maxLevel)
    eq.setBandLevel(index.toShort(), level.toShort())
  }

  private fun releaseInternal() {
    try {
      equalizer?.release()
    } catch (_: Throwable) {
    } finally {
      equalizer = null
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
      try {
        loudnessEnhancer?.release()
      } catch (_: Throwable) {
      } finally {
        loudnessEnhancer = null
      }
    }
  }

  private fun clampDb(value: Float): Float {
    return value.coerceIn(-20f, 20f)
  }
}
