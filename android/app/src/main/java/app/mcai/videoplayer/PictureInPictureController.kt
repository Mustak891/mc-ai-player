package app.mcai.videoplayer

object PictureInPictureController {
  @Volatile
  var autoEnterEnabled: Boolean = false

  const val ACTION_BACKWARD = "app.mcai.videoplayer.pip.BACKWARD"
  const val ACTION_PLAY_PAUSE = "app.mcai.videoplayer.pip.PLAY_PAUSE"
  const val ACTION_FORWARD = "app.mcai.videoplayer.pip.FORWARD"
  const val ACTION_SETTINGS = "app.mcai.videoplayer.pip.SETTINGS"
  const val ACTION_CLOSE = "app.mcai.videoplayer.pip.CLOSE"
  const val ACTION_EXPAND = "app.mcai.videoplayer.pip.EXPAND"
}
