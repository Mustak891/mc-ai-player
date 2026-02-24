package app.mcai.videoplayer

object FloatingOverlayController {
  const val ACTION_START = "app.mcai.videoplayer.overlay.START"
  const val ACTION_STOP = "app.mcai.videoplayer.overlay.STOP"
  const val ACTION_TOGGLE_PLAY = "app.mcai.videoplayer.overlay.TOGGLE_PLAY"
  const val ACTION_EXPAND = "app.mcai.videoplayer.overlay.EXPAND"
  const val ACTION_CLOSE = "app.mcai.videoplayer.overlay.CLOSE"

  const val EXTRA_URI = "overlay_uri"
  const val EXTRA_POSITION_MS = "overlay_position_ms"
  const val EXTRA_PLAY_WHEN_READY = "overlay_play_when_ready"
  const val EXTRA_TITLE = "overlay_title"

  const val EVENT_ACTION = "McAiOverlayAction"
}

