package app.mcai.videoplayer

import android.app.Service
import android.content.Intent
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import java.io.File
import kotlin.math.abs

class McAiFloatingOverlayService : Service() {
  private var windowManager: WindowManager? = null
  private var rootView: FrameLayout? = null
  private var controlsLayer: FrameLayout? = null
  private var playerView: PlayerView? = null
  private var playPauseButton: ImageButton? = null
  private var windowLayoutParams: WindowManager.LayoutParams? = null
  private var closeTargetView: FrameLayout? = null
  private var closeTargetLayoutParams: WindowManager.LayoutParams? = null
  private var player: ExoPlayer? = null

  private var controlsVisible = false
  private var isExpanded = false
  private var isCloseTargetVisible = false
  private var isOverCloseTarget = false
  private var isStopping = false

  private val mainHandler = Handler(Looper.getMainLooper())
  private val controlsAutoHideMs = 2800L
  private val hideControlsRunnable = Runnable { hideControls(true) }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> animateOutAndStop()
      ACTION_START -> {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
          stopSelf()
          return START_NOT_STICKY
        }
        val uri = intent.getStringExtra(EXTRA_URI).orEmpty()
        val positionMs = intent.getLongExtra(EXTRA_POSITION_MS, 0L).coerceAtLeast(0L)
        val playWhenReady = intent.getBooleanExtra(EXTRA_PLAY_WHEN_READY, true)
        startOrUpdateOverlay(uri, positionMs, playWhenReady)
      }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    mainHandler.removeCallbacksAndMessages(null)
    removeOverlay()
    super.onDestroy()
  }

  private fun startOrUpdateOverlay(uri: String, positionMs: Long, playWhenReady: Boolean) {
    if (uri.isBlank()) return
    ensureOverlayView()
    ensurePlayer()
    val parsedUri = parseUri(uri)
    val mediaItem = MediaItem.fromUri(parsedUri)
    player?.apply {
      setMediaItem(mediaItem)
      prepare()
      seekTo(positionMs)
      this.playWhenReady = playWhenReady
    }
    updatePlayPauseIcon()
    hideControls(false)
  }

  private fun ensurePlayer() {
    if (player != null) return
    val renderersFactory = DefaultRenderersFactory(this).setExtensionRendererMode(
      DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER
    )
    player = ExoPlayer.Builder(this, renderersFactory).build().apply {
      setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(C.USAGE_MEDIA)
          .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
          .build(),
        true
      )
      addListener(object : androidx.media3.common.Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
          updatePlayPauseIcon()
        }
      })
    }
    playerView?.player = player
  }

  private fun ensureOverlayView() {
    if (rootView != null && windowLayoutParams != null && windowManager != null) return
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    val overlayBgColor = resolveOverlayBackgroundColor()

    val collapsedWidth = dp(188)
    val collapsedHeight = dp(106)
    val margin = dp(14)
    val metrics = resources.displayMetrics

    windowLayoutParams = WindowManager.LayoutParams(
      collapsedWidth,
      collapsedHeight,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION")
        WindowManager.LayoutParams.TYPE_PHONE
      },
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = (metrics.widthPixels - collapsedWidth - margin).coerceAtLeast(0)
      y = (metrics.heightPixels - collapsedHeight - (margin * 4)).coerceAtLeast(0)
    }

    val dragTouchListener = createDragTouchListener()

    val container = FrameLayout(this).apply {
      background = GradientDrawable().apply {
        cornerRadius = dp(12).toFloat()
        setColor(overlayBgColor)
        setStroke(dp(1), 0x33FFFFFF)
      }
      clipToOutline = true
      elevation = dp(8).toFloat()
      alpha = 0f
      scaleX = 0.96f
      scaleY = 0.96f
    }

    val playerSurface = PlayerView(this).apply {
      useController = false
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
      setBackgroundColor(overlayBgColor)
      setShutterBackgroundColor(overlayBgColor)
      subtitleView?.visibility = View.GONE
      setOnTouchListener(dragTouchListener)
    }
    playerView = playerSurface
    container.addView(playerSurface)

    val controls = FrameLayout(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
      background = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(0xAA000000.toInt(), 0x33000000, 0xAA000000.toInt())
      )
      alpha = 0f
      visibility = View.GONE
    }
    controlsLayer = controls

    val permissionButton = createTopButton(android.R.drawable.ic_menu_preferences) {
      openPipPermissionSettings()
      showControls(true)
    }.apply {
      layoutParams = FrameLayout.LayoutParams(dp(34), dp(34), Gravity.TOP or Gravity.START).apply {
        topMargin = dp(8)
        marginStart = dp(8)
      }
    }
    controls.addView(permissionButton)

    val closeButton = createCloseTopButton {
      val positionMs = player?.currentPosition ?: 0L
      val wasPlaying = player?.isPlaying == true
      closeOverlayAndStop(positionMs, wasPlaying)
    }.apply {
      layoutParams = FrameLayout.LayoutParams(dp(34), dp(34), Gravity.TOP or Gravity.END).apply {
        topMargin = dp(8)
        marginEnd = dp(8)
      }
    }
    controls.addView(closeButton)

    val bottomRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(8), dp(6), dp(8), dp(6))
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.WRAP_CONTENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
        Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
      ).apply {
        bottomMargin = dp(10)
      }
    }

    val rewindButton = createBottomButton(android.R.drawable.ic_media_rew) {
      val target = player ?: return@createBottomButton
      val next = (target.currentPosition - 10_000L).coerceAtLeast(0L)
      target.seekTo(next)
      showControls(true)
    }
    bottomRow.addView(rewindButton)

    bottomRow.addView(gapView(dp(8)))

    val pausePlay = createBottomButton(android.R.drawable.ic_media_pause) {
      val target = player ?: return@createBottomButton
      if (target.isPlaying) {
        target.pause()
      } else {
        target.play()
      }
      updatePlayPauseIcon()
      showControls(true)
    }
    playPauseButton = pausePlay
    bottomRow.addView(pausePlay)

    bottomRow.addView(gapView(dp(8)))

    val forwardButton = createBottomButton(android.R.drawable.ic_media_ff) {
      val target = player ?: return@createBottomButton
      val duration = target.duration
      val requested = target.currentPosition + 10_000L
      val next = if (duration > 0L) {
        requested.coerceAtMost(duration)
      } else {
        requested
      }
      target.seekTo(next)
      showControls(true)
    }
    bottomRow.addView(forwardButton)

    bottomRow.addView(gapView(dp(8)))

    val reopenButton = createBottomButton(android.R.drawable.ic_menu_crop) {
      val positionMs = player?.currentPosition ?: 0L
      val wasPlaying = player?.isPlaying == true
      McAiFloatingOverlayModule.emitOverlayAction(
        McAiFloatingOverlayModule.ACTION_EXPAND,
        positionMs,
        wasPlaying
      )
      bringAppToFront()
      stopSelf()
    }
    bottomRow.addView(reopenButton)

    controls.addView(bottomRow)
    container.addView(controls)

    rootView = container
    try {
      windowManager?.addView(container, windowLayoutParams)
      container.animate()
        .alpha(1f)
        .scaleX(1f)
        .scaleY(1f)
        .setDuration(190L)
        .start()
    } catch (_: Throwable) {
      removeOverlay()
      stopSelf()
    }
  }

  private fun createTopButton(iconRes: Int, action: () -> Unit): ImageButton {
    return ImageButton(this).apply {
      setImageResource(iconRes)
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(0x55000000)
      }
      imageTintList = ColorStateList.valueOf(0xFFFFFFFF.toInt())
      setOnClickListener { action() }
    }
  }

  private fun createCloseTopButton(action: () -> Unit): TextView {
    return TextView(this).apply {
      text = "X"
      setTextColor(0xFFFFFFFF.toInt())
      textSize = 13f
      gravity = Gravity.CENTER
      typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(0x66000000)
      }
      setOnClickListener { action() }
    }
  }

  private fun createBottomButton(iconRes: Int, action: () -> Unit): ImageButton {
    return ImageButton(this).apply {
      setImageResource(iconRes)
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(0x66000000)
      }
      imageTintList = ColorStateList.valueOf(0xFFFFFFFF.toInt())
      layoutParams = LinearLayout.LayoutParams(dp(34), dp(34))
      setOnClickListener { action() }
    }
  }

  private fun gapView(sizePx: Int): View {
    return View(this).apply {
      layoutParams = LinearLayout.LayoutParams(sizePx, 1)
    }
  }

  private fun showControls(animate: Boolean) {
    val controls = controlsLayer ?: return
    controlsVisible = true
    mainHandler.removeCallbacks(hideControlsRunnable)
    setExpandedSize(true)
    controls.visibility = View.VISIBLE
    if (animate) {
      controls.animate().cancel()
      controls.animate().alpha(1f).setDuration(160L).start()
    } else {
      controls.alpha = 1f
    }
    mainHandler.postDelayed(hideControlsRunnable, controlsAutoHideMs)
  }

  private fun hideControls(animate: Boolean) {
    val controls = controlsLayer ?: return
    controlsVisible = false
    mainHandler.removeCallbacks(hideControlsRunnable)
    setExpandedSize(false)
    if (animate) {
      controls.animate().cancel()
      controls.animate().alpha(0f).setDuration(140L).withEndAction {
        if (!controlsVisible) {
          controls.visibility = View.GONE
        }
      }.start()
    } else {
      controls.alpha = 0f
      controls.visibility = View.GONE
    }
  }

  private fun updatePlayPauseIcon() {
    val isPlaying = player?.isPlaying == true
    playPauseButton?.setImageResource(
      if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
    )
  }

  private fun createDragTouchListener(): View.OnTouchListener {
    var startX = 0
    var startY = 0
    var touchX = 0f
    var touchY = 0f
    var moved = false
    var longPressTriggered = false
    var longPressArmed = false
    val longPressRunnable = Runnable {
      longPressTriggered = true
      showCloseTarget()
      updateCloseTargetHitState()
    }

    return View.OnTouchListener { _, event ->
      val params = windowLayoutParams ?: return@OnTouchListener false
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          startX = params.x
          startY = params.y
          touchX = event.rawX
          touchY = event.rawY
          moved = false
          longPressTriggered = false
          longPressArmed = true
          mainHandler.removeCallbacks(hideControlsRunnable)
          mainHandler.removeCallbacks(longPressRunnable)
          mainHandler.postDelayed(longPressRunnable, 320L)
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = (event.rawX - touchX).toInt()
          val dy = (event.rawY - touchY).toInt()
          if (abs(dx) > 3 || abs(dy) > 3) moved = true
          if (!longPressTriggered && longPressArmed && (abs(dx) > 8 || abs(dy) > 8)) {
            longPressArmed = false
            mainHandler.removeCallbacks(longPressRunnable)
          }
          val maxX = (resources.displayMetrics.widthPixels - params.width).coerceAtLeast(0)
          val maxY = (resources.displayMetrics.heightPixels - params.height).coerceAtLeast(0)
          params.x = (startX + dx).coerceIn(0, maxX)
          params.y = (startY + dy).coerceIn(0, maxY)
          try {
            windowManager?.updateViewLayout(rootView, params)
          } catch (_: Throwable) {
          }
          if (longPressTriggered) {
            updateCloseTargetHitState()
          }
          true
        }
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          mainHandler.removeCallbacks(longPressRunnable)
          if (longPressTriggered) {
            if (isOverCloseTarget) {
              val positionMs = player?.currentPosition ?: 0L
              val wasPlaying = player?.isPlaying == true
              closeOverlayAndStop(positionMs, wasPlaying)
              return@OnTouchListener true
            }
            hideCloseTarget()
          }
          if (!moved && !longPressTriggered) {
            if (controlsVisible) {
              hideControls(true)
            } else {
              showControls(true)
            }
          } else if (controlsVisible) {
            mainHandler.postDelayed(hideControlsRunnable, controlsAutoHideMs)
          }
          true
        }
        else -> false
      }
    }
  }

  private fun showCloseTarget() {
    if (isCloseTargetVisible) return
    val wm = windowManager ?: return
    val targetSize = dp(70)
    val marginBottom = dp(26)
    val target = FrameLayout(this).apply {
      setBackgroundColor(0xCC151515.toInt())
      elevation = dp(6).toFloat()
      val closeIcon = TextView(context).apply {
        text = "X"
        setTextColor(0xFFFFFFFF.toInt())
        textSize = 17f
        gravity = Gravity.CENTER
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        layoutParams = FrameLayout.LayoutParams(dp(28), dp(28), Gravity.CENTER)
      }
      addView(closeIcon)
    }

    val params = WindowManager.LayoutParams(
      targetSize,
      targetSize,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION")
        WindowManager.LayoutParams.TYPE_PHONE
      },
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
      x = 0
      y = marginBottom
    }

    try {
      wm.addView(target, params)
      closeTargetView = target
      closeTargetLayoutParams = params
      isCloseTargetVisible = true
      isOverCloseTarget = false
    } catch (_: Throwable) {
      closeTargetView = null
      closeTargetLayoutParams = null
      isCloseTargetVisible = false
      isOverCloseTarget = false
    }
  }

  private fun hideCloseTarget() {
    if (!isCloseTargetVisible) return
    try {
      closeTargetView?.let { view ->
        windowManager?.removeView(view)
      }
    } catch (_: Throwable) {
    } finally {
      closeTargetView = null
      closeTargetLayoutParams = null
      isCloseTargetVisible = false
      isOverCloseTarget = false
    }
  }

  private fun updateCloseTargetHitState() {
    if (!isCloseTargetVisible) return
    val wmParams = windowLayoutParams ?: return
    val overlayCenterX = wmParams.x + (wmParams.width / 2f)
    val overlayCenterY = wmParams.y + (wmParams.height / 2f)
    val screenW = resources.displayMetrics.widthPixels.toFloat()
    val screenH = resources.displayMetrics.heightPixels.toFloat()
    val targetCenterX = screenW / 2f
    val targetCenterY = screenH - dp(26) - (dp(70) / 2f)
    val distanceX = overlayCenterX - targetCenterX
    val distanceY = overlayCenterY - targetCenterY
    val hitRadius = dp(96).toFloat()
    val nowOver = (distanceX * distanceX) + (distanceY * distanceY) <= (hitRadius * hitRadius)
    if (nowOver == isOverCloseTarget) return
    isOverCloseTarget = nowOver
    closeTargetView?.setBackgroundColor(
      if (isOverCloseTarget) 0xCCB00020.toInt() else 0xCC151515.toInt()
    )
  }

  private fun setExpandedSize(expanded: Boolean) {
    if (isExpanded == expanded) return
    val params = windowLayoutParams ?: return
    isExpanded = expanded
    val nextWidth = if (expanded) dp(212) else dp(188)
    val nextHeight = if (expanded) dp(119) else dp(106)
    params.width = nextWidth
    params.height = nextHeight
    val maxX = (resources.displayMetrics.widthPixels - nextWidth).coerceAtLeast(0)
    val maxY = (resources.displayMetrics.heightPixels - nextHeight).coerceAtLeast(0)
    params.x = params.x.coerceIn(0, maxX)
    params.y = params.y.coerceIn(0, maxY)
    try {
      windowManager?.updateViewLayout(rootView, params)
    } catch (_: Throwable) {
    }
  }

  private fun openPipPermissionSettings() {
    try {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent("android.settings.PICTURE_IN_PICTURE_SETTINGS").apply {
          data = Uri.parse("package:$packageName")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = Uri.parse("package:$packageName")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
      }
      startActivity(intent)
    } catch (_: Throwable) {
    }
  }

  private fun bringAppToFront() {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    if (launchIntent != null) {
      startActivity(launchIntent)
    }
  }

  private fun animateOutAndStop() {
    if (isStopping) return
    isStopping = true
    mainHandler.removeCallbacksAndMessages(null)
    val view = rootView
    if (view == null) {
      stopSelf()
      return
    }
    view.animate()
      .alpha(0f)
      .scaleX(0.95f)
      .scaleY(0.95f)
      .setDuration(170L)
      .withEndAction { stopSelf() }
      .start()
  }

  private fun closeOverlayAndStop(positionMs: Long, wasPlaying: Boolean) {
    try {
      player?.pause()
    } catch (_: Throwable) {
    }
    McAiFloatingOverlayModule.emitOverlayAction(
      McAiFloatingOverlayModule.ACTION_CLOSE,
      positionMs,
      wasPlaying
    )
    hideCloseTarget()
    animateOutAndStop()
  }

  private fun resolveOverlayBackgroundColor(): Int {
    val nightMode = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
    return if (nightMode == Configuration.UI_MODE_NIGHT_YES) {
      0xFF000000.toInt()
    } else {
      // Keep mini-player dark in light mode to avoid white frame flashes.
      0xFF101010.toInt()
    }
  }

  private fun removeOverlay() {
    isStopping = false
    hideCloseTarget()
    try {
      rootView?.let { view ->
        windowManager?.removeView(view)
      }
    } catch (_: Throwable) {
    } finally {
      rootView = null
      controlsLayer = null
      playerView = null
      playPauseButton = null
      windowLayoutParams = null
    }
    try {
      player?.release()
    } catch (_: Throwable) {
    } finally {
      player = null
    }
  }

  private fun parseUri(uri: String): Uri {
    val parsed = Uri.parse(uri)
    if (!parsed.scheme.isNullOrBlank()) {
      return parsed
    }
    return Uri.fromFile(File(uri))
  }

  private fun dp(value: Int): Int {
    return TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      value.toFloat(),
      resources.displayMetrics
    ).toInt()
  }

  companion object {
    const val ACTION_START = "app.mcai.videoplayer.overlay.START"
    const val ACTION_STOP = "app.mcai.videoplayer.overlay.STOP"
    const val EXTRA_URI = "uri"
    const val EXTRA_POSITION_MS = "positionMs"
    const val EXTRA_PLAY_WHEN_READY = "playWhenReady"
    const val EXTRA_TITLE = "title"
  }
}
