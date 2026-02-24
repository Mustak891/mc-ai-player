package app.mcai.videoplayer

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.RectF
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
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import androidx.core.app.NotificationCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import kotlin.math.abs
import kotlin.math.hypot

class FloatingPlayerService : Service() {

  // ─── Window & Views ───────────────────────────────────────────────────────
  private var windowManager: WindowManager? = null
  private var overlayRoot: FrameLayout? = null
  private var playerView: PlayerView? = null
  private var controlsLayer: FrameLayout? = null
  private var player: ExoPlayer? = null
  private var overlayParams: WindowManager.LayoutParams? = null

  // Close target (bottom X bubble)
  private var closeTarget: FrameLayout? = null
  private var closeTargetParams: WindowManager.LayoutParams? = null
  private var closePulseAnimator: ObjectAnimator? = null

  // Icon views drawn via canvas
  private var playPauseIconView: IconView? = null

  // ─── State ────────────────────────────────────────────────────────────────
  private var isClosing = false
  private var controlsVisible = false
  private var inCloseZone = false
  private var isDragging = false

  private val mainHandler = Handler(Looper.getMainLooper())
  private val hideControlsRunnable = Runnable { hideControls() }

  // ─── Scalable Window Sizes ────────────────────────────────────────────────
  // The Window is sized for the "Expanded" state so scaling doesn't clip.
  // Minimal state = 0.92 scale. Expanded state = 1.0 scale.
  private val WIN_W_DP = 300f
  private val WIN_H_DP = 169f // ~16:9 aspect ratio

  private val SCALE_MINIMAL = 0.92f
  private val SCALE_EXPANDED = 1.0f

  override fun onBind(intent: Intent?): IBinder? = null

  // ─── Service entry ────────────────────────────────────────────────────────
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      FloatingOverlayController.ACTION_START       -> startOverlay(intent)
      FloatingOverlayController.ACTION_TOGGLE_PLAY -> togglePlay()
      FloatingOverlayController.ACTION_EXPAND      -> expandToApp()
      FloatingOverlayController.ACTION_CLOSE,
      FloatingOverlayController.ACTION_STOP        -> closeOverlay(false)
    }
    return START_STICKY
  }

  // ─── Overlay lifecycle ────────────────────────────────────────────────────
  private fun startOverlay(intent: Intent) {
    val uri          = intent.getStringExtra(FloatingOverlayController.EXTRA_URI) ?: return
    val positionMs   = intent.getLongExtra(FloatingOverlayController.EXTRA_POSITION_MS, 0L)
    val playWhenReady= intent.getBooleanExtra(FloatingOverlayController.EXTRA_PLAY_WHEN_READY, true)
    val title        = intent.getStringExtra(FloatingOverlayController.EXTRA_TITLE) ?: "MC AI Player"

    ensureForeground(title)
    createOverlayIfNeeded()

    if (player == null) {
      player = ExoPlayer.Builder(this).build().also { exo ->
        exo.addListener(object : Player.Listener {
          override fun onIsPlayingChanged(isPlaying: Boolean) {
            mainHandler.post { playPauseIconView?.setPlaying(isPlaying) ; playPauseIconView?.invalidate() }
          }
        })
      }
    }

    val mediaItem = MediaItem.fromUri(uri)
    player?.setMediaItem(mediaItem)
    player?.prepare()
    player?.seekTo(positionMs)
    if (playWhenReady) player?.play() else player?.pause()
    playerView?.player = player
    playPauseIconView?.setPlaying(player?.isPlaying == true)
    playPauseIconView?.invalidate()

    // Start minimal – no controls, scaled down
    hideControls(animate = false)
  }

  // ─── View construction ────────────────────────────────────────────────────
  private fun createOverlayIfNeeded() {
    if (overlayRoot != null) return
    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val wm = windowManager ?: return

    val width  = dp(WIN_W_DP)
    val height = dp(WIN_H_DP)
    val metrics= resources.displayMetrics
    val initialX = (metrics.widthPixels - width - dp(14f)).coerceAtLeast(dp(8f))
    val initialY = (metrics.heightPixels - height - dp(130f)).coerceAtLeast(dp(52f))

    val type = overlayWindowType()

    overlayParams = WindowManager.LayoutParams(
      width, height, type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = initialX
      y = initialY
    }

    // ── Root container ──────────────────────────────────────────────────────
    val root = FrameLayout(this).apply {
      // Background with rounded corners and subtle border
      background = GradientDrawable().apply {
        cornerRadius = dp(16f).toFloat()
        setColor(Color.BLACK)
        setStroke(dp(1f), Color.parseColor("#33FFFFFF"))
      }
      clipToOutline = true
      elevation = dp(12f).toFloat()
      alpha  = 0f
      scaleX = SCALE_MINIMAL
      scaleY = SCALE_MINIMAL
      // Pivot center for scaling
      pivotX = width / 2f
      pivotY = height / 2f
    }

    // ── Video surface ───────────────────────────────────────────────────────
    val pv = PlayerView(this).apply {
      useController = false
      setShutterBackgroundColor(Color.BLACK)
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
    }

    // ── Controls overlay ────────────────────────────────────────────────────
    val controls = FrameLayout(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
      // Gradient scrim for visibility
      val grad = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(0x99000000.toInt(), 0x44000000, 0x99000000.toInt())
      )
      background = grad
      alpha = 0f
      visibility = View.GONE
    }

    // ┌── Top row: Settings (left) ──────────────────────────────────────────
    val settingsBtn = IconButton(this, IconType.SETTINGS, dp(40f)).apply {
      layoutParams = FrameLayout.LayoutParams(dp(40f), dp(40f), Gravity.TOP or Gravity.START).apply {
        topMargin   = dp(8f)
        marginStart = dp(12f)
      }
      setOnClickListener { openOverlaySettings(); showControls() }
    }

    // ┌── Top row: Expand (right) ───────────────────────────────────────────
    val expandBtn = IconButton(this, IconType.EXPAND, dp(40f)).apply {
      layoutParams = FrameLayout.LayoutParams(dp(40f), dp(40f), Gravity.TOP or Gravity.END).apply {
        topMargin  = dp(8f)
        marginEnd  = dp(12f)
      }
      setOnClickListener { expandToApp() }
    }

    // ┌── Center: Play/Pause ────────────────────────────────────────────────
    val playPauseBtn = IconButton(this, IconType.PLAY, dp(64f)).apply {
      layoutParams = FrameLayout.LayoutParams(dp(64f), dp(64f), Gravity.CENTER)
      setOnClickListener { togglePlay(); showControls() }
    }
    playPauseIconView = playPauseBtn.iconView

    // ┌── Bottom row: Rewind | Forward ──────────────────────────────────────
    val bottomRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity     = Gravity.CENTER
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.WRAP_CONTENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
        Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
      ).apply { bottomMargin = dp(16f) }
    }

    val rewindBtn = IconButton(this, IconType.REWIND, dp(48f)).apply {
      setOnClickListener { seekByMs(-10_000L); showControls() }
    }
    val forwardBtn = IconButton(this, IconType.FORWARD, dp(48f)).apply {
      setOnClickListener { seekByMs(10_000L); showControls() }
    }

    bottomRow.addView(rewindBtn)
    bottomRow.addView(gap(24))
    bottomRow.addView(forwardBtn)

    controls.addView(settingsBtn)
    controls.addView(expandBtn)
    controls.addView(playPauseBtn)
    controls.addView(bottomRow)

    root.addView(pv)
    root.addView(controls)
    setupTouch(root)

    wm.addView(root, overlayParams)
    overlayRoot   = root
    playerView    = pv
    controlsLayer = controls

    // Entry animation
    root.animate()
      .alpha(1f)
      .scaleX(SCALE_MINIMAL)
      .scaleY(SCALE_MINIMAL)
      .setDuration(300L)
      .setInterpolator(OvershootInterpolator(0.8f))
      .start()
  }

  // ─── Touch handler ────────────────────────────────────────────────────────
  private fun setupTouch(surface: View) {
    var startParamX = 0
    var startParamY = 0
    var touchX = 0f
    var touchY = 0f
    var moved  = false
    var downTimeMs = 0L

    surface.setOnTouchListener { _, event ->
      val params = overlayParams ?: return@setOnTouchListener false
      when (event.action) {

        MotionEvent.ACTION_DOWN -> {
          moved        = false
          isDragging   = false
          startParamX  = params.x
          startParamY  = params.y
          touchX       = event.rawX
          touchY       = event.rawY
          downTimeMs   = System.currentTimeMillis()
          true
        }

        MotionEvent.ACTION_MOVE -> {
          val dx = (event.rawX - touchX).toInt()
          val dy = (event.rawY - touchY).toInt()

          if (!moved && (abs(dx) > 8 || abs(dy) > 8)) {
            moved      = true
            isDragging = true
            showCloseTarget()
            // If dragging starts, shrink slightly to signify lift
            surface.animate().cancel()
            surface.animate().scaleX(SCALE_MINIMAL).scaleY(SCALE_MINIMAL).alpha(0.92f).setDuration(120).start()
          }

          if (moved) {
            params.x = startParamX + dx
            params.y = startParamY + dy
            windowManager?.updateViewLayout(overlayRoot, params)

            if (isOverlayNearCloseTarget()) {
              updateCloseTargetHighlight(true)
              // Magnetic snap to X
              val dm      = resources.displayMetrics
              val targetParams = closeTargetParams
              if (targetParams != null) {
                  val targetX = (dm.widthPixels / 2) - (params.width / 2)
                  val targetY = dm.heightPixels - targetParams.y - params.height - dp(20f) // Just above the X
                  params.x   = (params.x * 0.65f + targetX * 0.35f).toInt()
                  params.y   = (params.y * 0.65f + targetY * 0.35f).toInt()
                  windowManager?.updateViewLayout(overlayRoot, params)
              }
            } else {
              updateCloseTargetHighlight(false)
            }
          }
          true
        }

        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          val wasTap = !moved && (System.currentTimeMillis() - downTimeMs) < 300

          if (moved && isOverlayNearCloseTarget()) {
            hideCloseTarget()
            closeOverlay(false)
            return@setOnTouchListener true
          }

          hideCloseTarget()
          updateCloseTargetHighlight(false)
          isDragging = false

          if (wasTap) {
            if (controlsVisible) hideControls() else showControls()
          } else {
            // Restore scale/alpha after drag
            val targetScale = if (controlsVisible) SCALE_EXPANDED else SCALE_MINIMAL
            surface.animate().scaleX(targetScale).scaleY(targetScale).alpha(1f).setDuration(150).start()
            snapToNearestEdge()
          }
          true
        }

        else -> false
      }
    }
  }

  // ─── Controls show/hide (Tap to enlarge) ──────────────────────────────────
  private fun showControls() {
    val controls = controlsLayer ?: return
    controlsVisible = true
    controls.visibility = View.VISIBLE
    controls.animate().cancel()
    overlayRoot?.animate()?.cancel()

    // Fade in controls
    controls.animate()
      .alpha(1f)
      .setDuration(180L)
      .setInterpolator(DecelerateInterpolator())
      .start()

    // Enlarge window (scale up)
    overlayRoot?.animate()
      ?.scaleX(SCALE_EXPANDED)
      ?.scaleY(SCALE_EXPANDED)
      ?.setDuration(220L)
      ?.setInterpolator(OvershootInterpolator(0.6f))
      ?.start()

    scheduleHideControls()
  }

  private fun hideControls(animate: Boolean = true) {
    val controls = controlsLayer ?: return
    controlsVisible = false
    mainHandler.removeCallbacks(hideControlsRunnable)
    controls.animate().cancel()
    overlayRoot?.animate()?.cancel()

    if (animate) {
      controls.animate()
        .alpha(0f)
        .setDuration(180L)
        .setInterpolator(DecelerateInterpolator())
        .withEndAction { if (!controlsVisible) controls.visibility = View.GONE }
        .start()

      // Shrink window (scale down)
      overlayRoot?.animate()
        ?.scaleX(SCALE_MINIMAL)
        ?.scaleY(SCALE_MINIMAL)
        ?.setDuration(200L)
        ?.setInterpolator(DecelerateInterpolator())
        ?.start()
    } else {
      controls.alpha = 0f
      controls.visibility = View.GONE
      overlayRoot?.scaleX = SCALE_MINIMAL
      overlayRoot?.scaleY = SCALE_MINIMAL
    }
  }

  private fun scheduleHideControls() {
    mainHandler.removeCallbacks(hideControlsRunnable)
    mainHandler.postDelayed(hideControlsRunnable, 3000L)
  }

  // ─── Close target (Red Bubble with X) ─────────────────────────────────────
  private fun showCloseTarget() {
    if (closeTarget != null) return
    val wm   = windowManager ?: return
    val type = overlayWindowType()
    val size = dp(80f)

    // Red bubble container
    val container = FrameLayout(this).apply {
        // Red circle with shadow
        background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.parseColor("#EE4444")) // Red
            setStroke(dp(2f), Color.WHITE)
        }
        elevation = dp(8f).toFloat()
        alpha = 0f
        scaleX = 0f
        scaleY = 0f
        translationY = dp(60f).toFloat()
    }

    // White X icon
    val xIcon = object : View(this) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            strokeWidth = dp(4f).toFloat()
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
        }
        override fun onDraw(canvas: Canvas) {
            val cx = width / 2f
            val cy = height / 2f
            val r  = minOf(width, height) * 0.28f
            canvas.drawLine(cx - r, cy - r, cx + r, cy + r, paint)
            canvas.drawLine(cx + r, cy - r, cx - r, cy + r, paint)
        }
    }.apply {
        layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
    }

    container.addView(xIcon)

    val params = WindowManager.LayoutParams(
      size, size, type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
      y = dp(40f)
    }

    wm.addView(container, params)
    closeTarget       = container
    closeTargetParams = params

    container.animate()
      .alpha(1f)
      .scaleX(1f)
      .scaleY(1f)
      .translationY(0f)
      .setDuration(240L)
      .setInterpolator(OvershootInterpolator(1.2f))
      .start()
  }

  private fun hideCloseTarget() {
    closeTarget?.let { view ->
      view.animate()
        .alpha(0f)
        .scaleX(0.5f)
        .scaleY(0.5f)
        .translationY(dp(60f).toFloat())
        .setDuration(180L)
        .setInterpolator(DecelerateInterpolator())
        .withEndAction {
          try { windowManager?.removeView(view) } catch (_: Exception) {}
        }
        .start()
    }
    closeTarget       = null
    closeTargetParams = null
    inCloseZone       = false
  }

  private fun isOverlayNearCloseTarget(): Boolean {
    val params       = overlayParams       ?: return false
    val targetParams = closeTargetParams   ?: return false
    val dm           = resources.displayMetrics
    val overlayCx    = params.x + params.width  / 2
    val overlayCy    = params.y + params.height / 2
    val targetCx     = dm.widthPixels / 2
    val targetCy     = dm.heightPixels - targetParams.y - (targetParams.height / 2)
    val tolerance    = dp(50f) 

    return hypot((overlayCx - targetCx).toDouble(), (overlayCy - targetCy).toDouble()) < tolerance + (targetParams.width / 2)
  }

  private fun updateCloseTargetHighlight(active: Boolean) {
    if (inCloseZone == active) return
    inCloseZone = active
    closeTarget?.animate()?.cancel()
    closeTarget?.animate()
      ?.scaleX(if (active) 1.3f else 1f)
      ?.scaleY(if (active) 1.3f else 1f)
      ?.setDuration(140L)
      ?.setInterpolator(DecelerateInterpolator())
      ?.start()
    
    // Suck effect on video
    overlayRoot?.animate()
        ?.scaleX(if(active) 0.6f else SCALE_MINIMAL)
        ?.scaleY(if(active) 0.6f else SCALE_MINIMAL)
        ?.alpha(if(active) 0.6f else 0.94f)
        ?.setDuration(160)
        ?.start()
  }

  // ─── Playback helpers ─────────────────────────────────────────────────────
  private fun togglePlay() {
    val p = player ?: return
    if (p.isPlaying) p.pause() else p.play()
    playPauseIconView?.setPlaying(p.isPlaying)
    playPauseIconView?.invalidate()
  }

  private fun seekByMs(deltaMs: Long) {
    val p        = player   ?: return
    val duration = p.duration.takeIf { it > 0 } ?: Long.MAX_VALUE
    p.seekTo((p.currentPosition + deltaMs).coerceIn(0L, duration))
  }

  private fun expandToApp() {
    val position = player?.currentPosition ?: 0L
    McAiFloatingOverlayModule.emitOverlayEvent(FloatingOverlayController.ACTION_EXPAND, position)
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    if (launch != null) {
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
      startActivity(launch)
    }
    closeOverlay(true)
  }

  // ─── Close ────────────────────────────────────────────────────────────────
  private fun closeOverlay(fromExpand: Boolean) {
    if (isClosing) return
    isClosing = true
    val position = player?.currentPosition ?: 0L
    if (!fromExpand) {
      McAiFloatingOverlayModule.emitOverlayEvent(FloatingOverlayController.ACTION_CLOSE, position)
    }

    mainHandler.removeCallbacks(hideControlsRunnable)
    hideCloseTarget()

    val view = overlayRoot
    if (view != null) {
      view.animate()
        .alpha(0f)
        .scaleX(0.5f)
        .scaleY(0.5f)
        .setDuration(220L)
        .setListener(object : AnimatorListenerAdapter() {
          override fun onAnimationEnd(animation: Animator) {
            try { windowManager?.removeView(view) } catch (_: Exception) {}
            releaseAndStop()
          }
        })
        .start()
    } else {
      releaseAndStop()
    }
  }

  private fun releaseAndStop() {
    overlayRoot     = null
    controlsLayer   = null
    playerView      = null
    playPauseIconView = null
    player?.release()
    player = null
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  // ─── Settings ─────────────────────────────────────────────────────────────
  private fun openOverlaySettings() {
    try {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:$packageName")
      ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
      startActivity(intent)
    } catch (_: Exception) {
      val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.parse("package:$packageName")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      startActivity(fallback)
    }
  }

  // ─── Snap to edge ─────────────────────────────────────────────────────────
  private fun snapToNearestEdge() {
    val params = overlayParams ?: return
    val dm     = resources.displayMetrics
    val margin = dp(8f)
    val targetX = if (params.x + params.width / 2 < dm.widthPixels / 2) {
      margin
    } else {
      (dm.widthPixels - params.width - margin).coerceAtLeast(margin)
    }
    val targetY = params.y.coerceIn(dp(44f), dm.heightPixels - params.height - dp(46f))
    animateOverlayTo(targetX, targetY)
  }

  private fun animateOverlayTo(targetX: Int, targetY: Int) {
    val params = overlayParams ?: return
    val startX = params.x
    val startY = params.y
    ValueAnimator.ofFloat(0f, 1f).apply {
      duration    = 250L
      interpolator= DecelerateInterpolator()
      addUpdateListener {
        val t   = it.animatedValue as Float
        params.x= (startX + (targetX - startX) * t).toInt()
        params.y= (startY + (targetY - startY) * t).toInt()
        windowManager?.updateViewLayout(overlayRoot, params)
      }
      start()
    }
  }

  // ─── Foreground notification ───────────────────────────────────────────────
  private fun ensureForeground(title: String) {
    val channelId = "mc_ai_overlay_playback"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val channel = NotificationChannel(channelId, "Floating playback", NotificationManager.IMPORTANCE_LOW)
      manager.createNotificationChannel(channel)
    }
    val closeIntent = Intent(this, FloatingPlayerService::class.java).apply {
      action = FloatingOverlayController.ACTION_CLOSE
    }
    val closePi = PendingIntent.getService(
      this, 3001, closeIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val notification: Notification = NotificationCompat.Builder(this, channelId)
      .setContentTitle(title)
      .setContentText("Tap to open")
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setOngoing(true)
      .setContentIntent(PendingIntent.getActivity(this, 0, packageManager.getLaunchIntentForPackage(packageName), PendingIntent.FLAG_IMMUTABLE))
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Close", closePi)
      .build()
    startForeground(4122, notification)
  }

  override fun onDestroy() {
    super.onDestroy()
    if (!isClosing) {
      try { closeTarget?.let { windowManager?.removeView(it) } } catch (_: Exception) {}
      player?.release()
      player = null
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private fun overlayWindowType(): Int = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
  } else {
    @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
  }

  private fun dp(value: Float): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, resources.displayMetrics).toInt()

  private fun gap(sizeDp: Int): View = View(this).apply {
    layoutParams = LinearLayout.LayoutParams(dp(sizeDp.toFloat()), 1)
  }

  // ─── Simple Helper View for Icons ─────────────────────────────────────────
  inner class IconButton(context: Context, type: IconType, sizePx: Int) : FrameLayout(context) {
    val iconView = IconView(context, type)
    init {
      // Ripple effect
      val outValue = TypedValue()
      context.theme.resolveAttribute(android.R.attr.selectableItemBackgroundBorderless, outValue, true)
      setBackgroundResource(outValue.resourceId)

      addView(iconView, LayoutParams(sizePx, sizePx, Gravity.CENTER))
    }
  }

  enum class IconType { PLAY, PAUSE, REWIND, FORWARD, SETTINGS, EXPAND }

  inner class IconView(context: Context, private var iconType: IconType) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      style = Paint.Style.FILL
    }
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color       = Color.WHITE
      style       = Paint.Style.STROKE
      strokeWidth = 0f
      strokeCap   = Paint.Cap.ROUND
      strokeJoin  = Paint.Join.ROUND
    }

    fun setPlaying(playing: Boolean) { iconType = if (playing) IconType.PAUSE else IconType.PLAY }

    override fun onDraw(canvas: Canvas) {
      val w  = width.toFloat()
      val h  = height.toFloat()
      val cx = w / 2f
      val cy = h / 2f

      when (iconType) {

        IconType.PLAY -> {
          val path = Path()
          val r    = minOf(w, h) * 0.32f
          path.moveTo(cx - r * 0.5f, cy - r)
          path.lineTo(cx + r * 1.0f, cy)
          path.lineTo(cx - r * 0.5f, cy + r)
          path.close()
          canvas.drawPath(path, paint)
        }

        IconType.PAUSE -> {
          val barW  = minOf(w, h) * 0.14f
          val barH  = minOf(w, h) * 0.45f
          val gap   = minOf(w, h) * 0.14f
          val left  = cx - gap / 2 - barW
          val right = cx + gap / 2
          val top   = cy - barH / 2
          val bot   = cy + barH / 2
          canvas.drawRoundRect(RectF(left,  top, left  + barW, bot), 6f, 6f, paint)
          canvas.drawRoundRect(RectF(right, top, right + barW, bot), 6f, 6f, paint)
        }

        IconType.REWIND -> {
          strokePaint.strokeWidth = minOf(w, h) * 0.08f
          strokePaint.style = Paint.Style.STROKE
          val r = minOf(w, h) * 0.22f
          val path = Path()
          path.moveTo(cx - 2f, cy - r)
          path.lineTo(cx - 2f - r * 1.4f, cy)
          path.lineTo(cx - 2f, cy + r)
          
          val path2 = Path()
          path2.moveTo(cx + r * 0.7f, cy - r)
          path2.lineTo(cx + r * 0.7f - r * 1.4f, cy)
          path2.lineTo(cx + r * 0.7f, cy + r)
          
          canvas.drawPath(path,  strokePaint)
          canvas.drawPath(path2, strokePaint)
        }

        IconType.FORWARD -> {
          strokePaint.strokeWidth = minOf(w, h) * 0.08f
          strokePaint.style = Paint.Style.STROKE
          val r = minOf(w, h) * 0.22f
          val path = Path()
          path.moveTo(cx + 2f, cy - r)
          path.lineTo(cx + 2f + r * 1.4f, cy)
          path.lineTo(cx + 2f, cy + r)

          val path2 = Path()
          path2.moveTo(cx - r * 0.7f, cy - r)
          path2.lineTo(cx - r * 0.7f + r * 1.4f, cy)
          path2.lineTo(cx - r * 0.7f, cy + r)

          canvas.drawPath(path,  strokePaint)
          canvas.drawPath(path2, strokePaint)
        }

        IconType.SETTINGS -> {
          strokePaint.strokeWidth = minOf(w, h) * 0.08f
          strokePaint.style = Paint.Style.STROKE
          canvas.drawCircle(cx, cy, minOf(w,h) * 0.25f, strokePaint)
          // Add some simple lines for teeth
          for (i in 0 until 8) {
              canvas.save()
              canvas.rotate(i * 45f, cx, cy)
              canvas.drawLine(cx, cy - minOf(w,h)*0.25f, cx, cy - minOf(w,h)*0.35f, strokePaint)
              canvas.restore()
          }
        }

        IconType.EXPAND -> {
            strokePaint.strokeWidth = minOf(w, h) * 0.08f
            strokePaint.style = Paint.Style.STROKE
            val r = minOf(w, h) * 0.25f
            canvas.drawRect(cx - r, cy - r, cx + r, cy + r, strokePaint)
            // Arrows
            strokePaint.strokeWidth = minOf(w, h) * 0.06f
            canvas.drawLine(cx - r + 4, cy + r - 4, cx + r - 4, cy - r + 4, strokePaint)
        }
      }
    }
  }
}
