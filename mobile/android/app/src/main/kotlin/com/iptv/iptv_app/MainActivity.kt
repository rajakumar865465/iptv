package com.iptv.iptv_app

import android.app.PictureInPictureParams
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Rational
import android.view.WindowManager
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    private val PIP_CHANNEL = "com.iptv.iptv_app/pip"
    private val UPDATER_CHANNEL = "com.iptv.iptv_app/updater"
    private val SCREEN_CHANNEL = "com.iptv.iptv_app/screen"
    private var methodChannel: MethodChannel? = null
    private var isPipAllowed = false

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // 1. PiP MethodChannel
        methodChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, PIP_CHANNEL)
        methodChannel?.setMethodCallHandler { call, result ->
            if (call.method == "setPipAllowed") {
                isPipAllowed = call.arguments as Boolean
                result.success(null)
            } else {
                result.notImplemented()
            }
        }

        // 2. Native In-App APK Updater MethodChannel
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, UPDATER_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "getAppCacheDirectory" -> {
                    try {
                        val updateDir = File(applicationContext.cacheDir, "updates")
                        if (!updateDir.exists()) {
                            updateDir.mkdirs()
                        }
                        result.success(updateDir.absolutePath)
                    } catch (e: Exception) {
                        result.error("DIR_ERROR", e.localizedMessage, null)
                    }
                }
                "canRequestPackageInstalls" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        try {
                            result.success(packageManager.canRequestPackageInstalls())
                        } catch (e: Exception) {
                            result.success(true)
                        }
                    } else {
                        result.success(true)
                    }
                }
                "openInstallSettings" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        try {
                            val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                                data = Uri.parse("package:$packageName")
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            startActivity(intent)
                            result.success(true)
                        } catch (e: Exception) {
                            try {
                                val intent = Intent(Settings.ACTION_SECURITY_SETTINGS).apply {
                                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                }
                                startActivity(intent)
                                result.success(true)
                            } catch (e2: Exception) {
                                result.error("SETTINGS_ERROR", e2.localizedMessage, null)
                            }
                        }
                    } else {
                        result.success(false)
                    }
                }
                "installApk" -> {
                    val filePath = call.argument<String>("filePath")
                    if (filePath.isNullOrBlank()) {
                        result.error("INVALID_PATH", "File path cannot be null or empty", null)
                        return@setMethodCallHandler
                    }
                    val apkFile = File(filePath)
                    if (!apkFile.exists() || apkFile.length() == 0L) {
                        result.error("FILE_NOT_FOUND", "APK file does not exist or is empty: $filePath", null)
                        return@setMethodCallHandler
                    }

                    try {
                        val apkUri = FileProvider.getUriForFile(
                            applicationContext,
                            "$packageName.fileprovider",
                            apkFile
                        )
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            setDataAndType(apkUri, "application/vnd.android.package-archive")
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }

                        val resolveInfos = packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
                        for (info in resolveInfos) {
                            grantUriPermission(info.activityInfo.packageName, apkUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }

                        startActivity(intent)
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("INSTALL_ERROR", e.localizedMessage ?: e.message, null)
                    }
                }
                else -> result.notImplemented()
            }
        }

        // 3. Screen Hardware Backlight Control MethodChannel
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, SCREEN_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "setScreenBrightness" -> {
                    try {
                        val brightness = (call.argument<Double>("brightness") ?: 1.0).toFloat().coerceIn(0.1f, 1.0f)
                        val lp = window.attributes
                        lp.screenBrightness = brightness
                        window.attributes = lp
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("BRIGHTNESS_ERROR", e.localizedMessage, null)
                    }
                }
                "resetScreenBrightness" -> {
                    try {
                        val lp = window.attributes
                        lp.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
                        window.attributes = lp
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("RESET_ERROR", e.localizedMessage, null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (isPipAllowed && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val params = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(16, 9))
                .build()
            enterPictureInPictureMode(params)
        }
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration?) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        methodChannel?.invokeMethod("onPipChanged", isInPictureInPictureMode)
    }
}
