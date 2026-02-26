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
  private var closeTarget: View? = null
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
  private val controlsAutoHideMs = 3000L

  // ─── Scalable Window Sizes ────────────────────────────────────────────────
  // Keep a stable size/anchor to avoid perceptual jump on entry.
  private val WIN_W_DP = 300f
  private val WIN_H_DP = 169f // ~16:9 aspect ratio

  private val ENTRY_TRANSLATE_DP = 6f
  private val DRAG_ALPHA = 0.96f
  private val CLOSE_ZONE_ALPHA = 0.82f

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

    // Start with rich controls visible immediately.
    showControls(animate = false)
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
        WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH or
        WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
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
      translationY = dp(ENTRY_TRANSLATE_DP).toFloat()
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
    val settingsBtn = IconButton(this, IconType.SETTINGS, dp(36f)).apply {
      layoutParams = FrameLayout.LayoutParams(dp(36f), dp(36f), Gravity.TOP or Gravity.START).apply {
        topMargin   = dp(8f)
        marginStart = dp(10f)
      }
      setOnClickListener { openOverlaySettings(); showControls() }
    }

    // ┌── Top row: Expand (right) ───────────────────────────────────────────
    val expandBtn = IconButton(this, IconType.EXPAND, dp(36f)).apply {
      layoutParams = FrameLayout.LayoutParams(dp(36f), dp(36f), Gravity.TOP or Gravity.END).apply {
        topMargin  = dp(8f)
        marginEnd  = dp(10f)
      }
      setOnClickListener { expandToApp() }
    }

    // ┌── Bottom row: Rewind | Play/Pause | Forward | Close ─────────────────
    val bottomRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity     = Gravity.CENTER_VERTICAL
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.WRAP_CONTENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
        Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
      ).apply { bottomMargin = dp(14f) }
    }

    val rewindBtn = IconButton(this, IconType.REWIND, dp(48f)).apply {
      setOnClickListener { seekByMs(-10_000L); showControls() }
    }
    val playPauseBtn = IconButton(this, IconType.PLAY, dp(56f)).apply {
      setOnClickListener { togglePlay(); showControls() }
    }
    playPauseIconView = playPauseBtn.iconView
    val forwardBtn = IconButton(this, IconType.FORWARD, dp(48f)).apply {
      setOnClickListener { seekByMs(10_000L); showControls() }
    }
    bottomRow.addView(rewindBtn)
    bottomRow.addView(gap(12))
    bottomRow.addView(playPauseBtn)
    bottomRow.addView(gap(12))
    bottomRow.addView(forwardBtn)

    controls.addView(settingsBtn)
    controls.addView(expandBtn)
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
      .translationY(0f)
      .setDuration(170L)
      .setInterpolator(DecelerateInterpolator())
      .start()
  }

  // ─── Touch handler ────────────────────────────────────────────────────────
  private fun setupTouch(surface: View) {
    // Track last event position (not fixed origin) for per-frame delta.
    // This ensures every MOVE applies only the incremental delta, giving
    // pixel-perfect 1:1 tracking with zero lag.
    var lastRawX  = 0f
    var lastRawY  = 0f
    var moved     = false
    var downTimeMs= 0L

    surface.setOnTouchListener { _, event ->
      val params = overlayParams ?: return@setOnTouchListener false
      val dm     = resources.displayMetrics

      when (event.action) {

        MotionEvent.ACTION_DOWN -> {
          moved       = false
          isDragging  = false
          lastRawX    = event.rawX
          lastRawY    = event.rawY
          downTimeMs  = System.currentTimeMillis()
          // Cancel any in-progress snap animation immediately
          surface.animate().cancel()
          true
        }

        MotionEvent.ACTION_MOVE -> {
          // Per-event delta (not cumulative from finger-down origin)
          val dx = (event.rawX - lastRawX).toInt()
          val dy = (event.rawY - lastRawY).toInt()
          lastRawX = event.rawX
          lastRawY = event.rawY

          if (!moved && (abs(dx) > 6 || abs(dy) > 6)) {
            moved      = true
            isDragging = true
            showCloseTarget()
            // Set alpha directly — no View.animate() competing with position updates
            surface.alpha = DRAG_ALPHA
          }

          if (moved) {
            params.x = (params.x + dx).coerceIn(0, dm.widthPixels  - params.width)
            params.y = (params.y + dy).coerceIn(0, dm.heightPixels - params.height)
            windowManager?.updateViewLayout(overlayRoot, params)

            if (isOverlayNearCloseTarget()) {
              updateCloseTargetHighlight(true)
              // Magnetic snap toward X — gentle pull
              val targetX = (dm.widthPixels / 2) - (params.width / 2)
              val ctp = closeTargetParams
              if (ctp != null) {
                val targetY = dm.heightPixels - ctp.y - params.height - dp(20f)
                params.x = (params.x * 0.7f + targetX * 0.3f).toInt()
                params.y = (params.y * 0.7f + targetY * 0.3f).toInt()
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
            // Restore alpha and snap — smooth spring to nearest edge
            surface.animate().alpha(1f).setDuration(150).setInterpolator(DecelerateInterpolator()).start()
            snapToNearestEdge()
          }
          true
        }

        else -> false
      }
    }
  }

  // ─── Controls show/hide (Tap to enlarge) ──────────────────────────────────
  private fun showControls(animate: Boolean = true) {
    val controls = controlsLayer ?: return
    controlsVisible = true
    controls.visibility = View.VISIBLE
    controls.animate().cancel()
    overlayRoot?.animate()?.cancel()

    if (animate) {
      controls.animate()
        .alpha(1f)
        .setDuration(170L)
        .setInterpolator(DecelerateInterpolator())
        .start()
    } else {
      controls.alpha = 1f
    }

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
        .setDuration(160L)
        .setInterpolator(DecelerateInterpolator())
        .withEndAction { if (!controlsVisible) controls.visibility = View.GONE }
        .start()
    } else {
      controls.alpha = 0f
      controls.visibility = View.GONE
    }
  }

  private fun scheduleHideControls() {
    mainHandler.removeCallbacks(hideControlsRunnable)
    mainHandler.postDelayed(hideControlsRunnable, controlsAutoHideMs)
  }

  // ─── Close target (Red Bubble with X) ─────────────────────────────────────
  private fun showCloseTarget() {
    if (closeTarget != null) return
    val wm   = windowManager ?: return
    val type = overlayWindowType()
    val size = dp(80f)

    // Glassmorphism close target — single canvas view (circle + X)
    val container = object : View(this) {
        private val circlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.FILL
            color = Color.parseColor("#CC1A1A1A")   // ~80% opaque dark — frosted
        }
        private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = dp(1f).toFloat()
            color = Color.parseColor("#55FFFFFF")   // Subtle white rim
        }
        private val xPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = dp(2.2f).toFloat()
            strokeCap = Paint.Cap.ROUND
            color = Color.WHITE
        }
        override fun onDraw(canvas: Canvas) {
            val cx  = width / 2f
            val cy  = height / 2f
            val rad = minOf(width, height) / 2f - dp(4f)
            // Frosted glass circle
            canvas.drawCircle(cx, cy, rad, circlePaint)
            canvas.drawCircle(cx, cy, rad, borderPaint)
            // Crisp centered X — arms at 38% of radius
            val arm = rad * 0.38f
            canvas.drawLine(cx - arm, cy - arm, cx + arm, cy + arm, xPaint)
            canvas.drawLine(cx + arm, cy - arm, cx - arm, cy + arm, xPaint)
        }
    }.apply {
        alpha = 0f
        scaleX = 0f
        scaleY = 0f
        translationY = dp(60f).toFloat()
    }

    // Use container directly (no child FrameLayout needed)

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
    
    // Subtle focus effect near close target without resizing the overlay.
    overlayRoot?.animate()
        ?.alpha(if(active) CLOSE_ZONE_ALPHA else 1f)
        ?.setDuration(120)
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
        .translationY(dp(12f).toFloat())
        .setDuration(180L)
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
    // Spring-physics snap: fast start, decelerates smoothly
    val snapDuration = (120 + hypot((targetX - startX).toDouble(), (targetY - startY).toDouble()).toInt()
        .coerceIn(0, 180)).toLong()
    ValueAnimator.ofFloat(0f, 1f).apply {
      duration     = snapDuration
      interpolator = DecelerateInterpolator(2.2f)
      addUpdateListener {
        val t    = it.animatedValue as Float
        params.x = (startX + (targetX - startX) * t).toInt()
        params.y = (startY + (targetY - startY) * t).toInt()
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

  enum class IconType { PLAY, PAUSE, REWIND, FORWARD, SETTINGS, EXPAND, CLOSE }

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
          // 3-line equalizer/slider icon — clean, modern, universally readable
          strokePaint.strokeWidth = minOf(w, h) * 0.075f
          strokePaint.style  = Paint.Style.STROKE
          strokePaint.strokeCap = Paint.Cap.ROUND
          val lineHalfLen = minOf(w, h) * 0.28f
          val dotR        = minOf(w, h) * 0.075f
          val yOffsets    = listOf(-minOf(w,h)*0.19f, 0f, minOf(w,h)*0.19f)
          // Handle X positions (stagger for visual interest)
          val dotXOffsets = listOf(minOf(w,h)*0.06f, -minOf(w,h)*0.1f, minOf(w,h)*0.12f)

          yOffsets.forEachIndexed { i, yOff ->
            val dotX = cx + dotXOffsets[i]
            // Left segment
            canvas.drawLine(cx - lineHalfLen, cy + yOff, dotX - dotR * 1.6f, cy + yOff, strokePaint)
            // Right segment
            canvas.drawLine(dotX + dotR * 1.6f, cy + yOff, cx + lineHalfLen, cy + yOff, strokePaint)
            // Filled circle handle
            paint.color = Color.WHITE
            canvas.drawCircle(dotX, cy + yOff, dotR, paint)
          }
        }

        IconType.EXPAND -> {
          // Standard 4-corner bracket fullscreen icon — universally recognized
          strokePaint.strokeWidth = minOf(w, h) * 0.09f
          strokePaint.style  = Paint.Style.STROKE
          strokePaint.strokeCap = Paint.Cap.ROUND
          strokePaint.strokeJoin = Paint.Join.ROUND
          val r = minOf(w, h) * 0.27f  // distance from center to corner tip
          val s = minOf(w, h) * 0.14f  // arm length (L-shape)
          // Top-left
          canvas.drawLine(cx - r + s, cy - r, cx - r, cy - r, strokePaint)
          canvas.drawLine(cx - r,     cy - r, cx - r, cy - r + s, strokePaint)
          // Top-right
          canvas.drawLine(cx + r - s, cy - r, cx + r, cy - r, strokePaint)
          canvas.drawLine(cx + r,     cy - r, cx + r, cy - r + s, strokePaint)
          // Bottom-left
          canvas.drawLine(cx - r + s, cy + r, cx - r, cy + r, strokePaint)
          canvas.drawLine(cx - r,     cy + r, cx - r, cy + r - s, strokePaint)
          // Bottom-right
          canvas.drawLine(cx + r - s, cy + r, cx + r, cy + r, strokePaint)
          canvas.drawLine(cx + r,     cy + r, cx + r, cy + r - s, strokePaint)
        }

        IconType.CLOSE -> {
          strokePaint.strokeWidth = minOf(w, h) * 0.12f
          strokePaint.style = Paint.Style.STROKE
          val r = minOf(w, h) * 0.22f
          canvas.drawLine(cx - r, cy - r, cx + r, cy + r, strokePaint)
          canvas.drawLine(cx + r, cy - r, cx - r, cy + r, strokePaint)
        }
      }
    }
  }
}
