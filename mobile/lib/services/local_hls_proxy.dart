import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;

typedef TokenExpiredCallback = Future<String?> Function();

class LocalHlsProxy {
  HttpServer? _server;
  int get port => _server?.port ?? 0;
  bool get isRunning => _server != null;

  String? _currentRealUrl;
  Map<String, String>? _currentHeaders;
  TokenExpiredCallback? _onTokenExpired;

  // Map to store segment key -> actual absolute URL
  final Map<String, String> _segmentMap = {};
  
  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 15),
    validateStatus: (status) => status != null && status < 500, // Handle 403 manually
  ));

  Future<void> start() async {
    if (_server != null) return;
    try {
      _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      debugPrint('LocalHlsProxy started on port $port');
      _server!.listen(_handleRequest);
    } catch (e) {
      debugPrint('Failed to start LocalHlsProxy: $e');
    }
  }

  Future<void> stop() async {
    await _server?.close(force: true);
    _server = null;
    _segmentMap.clear();
    debugPrint('LocalHlsProxy stopped');
  }

  /// Returns the proxy URL to pass to media_kit
  String getProxyUrl(String realUrl, Map<String, String>? headers, TokenExpiredCallback onTokenExpired) {
    _currentRealUrl = realUrl;
    _currentHeaders = headers;
    _onTokenExpired = onTokenExpired;
    _segmentMap.clear();
    return 'http://127.0.0.1:$port/master.m3u8';
  }

  void updateRealUrl(String newUrl, Map<String, String>? newHeaders) {
    _currentRealUrl = newUrl;
    if (newHeaders != null) {
      _currentHeaders = newHeaders;
    }
  }

  /// Fetches and caches the playlist in the background to speed up channel switching.
  Future<void> prewarmPlaylist(String url, Map<String, String>? headers) async {
    try {
      debugPrint('Pre-warming playlist: $url');
      // Fix: Do not overwrite _currentRealUrl or _currentHeaders here, 
      // otherwise the currently playing channel will start fetching the next channel's segments!
      await _fetchAndParsePlaylist(url, overrideHeaders: headers);
    } catch (e) {
      debugPrint('Error prewarming playlist: $e');
    }
  }

  Future<void> _handleRequest(HttpRequest request) async {
    final path = request.uri.path;
    
    try {
      if (path == '/master.m3u8') {
        await _handlePlaylistRequest(request, request.uri.queryParameters['variant']);
      } else if (path == '/segment') {
        await _handleSegmentRequest(request);
      } else {
        request.response.statusCode = HttpStatus.notFound;
        await request.response.close();
      }
    } catch (e) {
      debugPrint('LocalHlsProxy error handling request: $e');
      if (request.response.connectionInfo != null) {
        request.response.statusCode = HttpStatus.internalServerError;
        await request.response.close();
      }
    }
  }

  Future<void> _handlePlaylistRequest(HttpRequest request, String? variantKey) async {
    if (_currentRealUrl == null) {
      request.response.statusCode = HttpStatus.notFound;
      await request.response.close();
      return;
    }

    // If it's asking for a specific variant playlist
    String targetUrl = _currentRealUrl!;
    if (variantKey != null && _segmentMap.containsKey(variantKey)) {
       targetUrl = _segmentMap[variantKey]!;
    }

    final m3u8Content = await _fetchAndParsePlaylist(targetUrl);
    if (m3u8Content == null) {
      request.response.statusCode = HttpStatus.badGateway;
      await request.response.close();
      return;
    }

    request.response.statusCode = HttpStatus.ok;
    request.response.headers.contentType = ContentType('application', 'vnd.apple.mpegurl');
    request.response.headers.add('Access-Control-Allow-Origin', '*');
    request.response.write(m3u8Content);
    await request.response.close();
  }

  Future<String?> _fetchAndParsePlaylist(String playlistUrl, {Map<String, String>? overrideHeaders}) async {
    try {
      final response = await _dio.get<String>(
        playlistUrl,
        options: Options(headers: overrideHeaders ?? _currentHeaders),
      );

      if (response.statusCode != 200 || response.data == null) {
        return null;
      }

      final lines = response.data!.split(RegExp(r'\r?\n'));
      final rewrittenLines = <String>[];
      final baseUrl = Uri.parse(playlistUrl);

      for (var line in lines) {
        if (line.isEmpty) continue;
        
        if (line.startsWith('#')) {
          if (line.startsWith('#EXT-X-STREAM-INF:')) {
            rewrittenLines.add(line);
          } else {
            rewrittenLines.add(line);
          }
        } else {
          final absoluteUri = baseUrl.resolve(line).toString();
          
          final uriWithoutQuery = baseUrl.resolve(line).replace(query: '').toString();
          final key = base64UrlEncode(utf8.encode(uriWithoutQuery)).replaceAll('=', '');
          
          _segmentMap[key] = absoluteUri;
          
          if (line.contains('.m3u8')) {
             rewrittenLines.add('http://127.0.0.1:$port/master.m3u8?variant=$key');
          } else {
             rewrittenLines.add('http://127.0.0.1:$port/segment?key=$key');
          }
        }
      }
      return rewrittenLines.join('\n') + '\n';
    } catch (e) {
      debugPrint('Error fetching playlist: $e');
      return null;
    }
  }

  Future<void> _handleSegmentRequest(HttpRequest request) async {
    final key = request.uri.queryParameters['key'];
    if (key == null) {
      request.response.statusCode = HttpStatus.badRequest;
      await request.response.close();
      return;
    }

    String? actualUrl = _segmentMap[key];
    if (actualUrl == null) {
      request.response.statusCode = HttpStatus.notFound;
      await request.response.close();
      return;
    }

    bool success = await _streamSegment(actualUrl, request.response);
    
    if (!success && _onTokenExpired != null) {
      debugPrint('Segment 403 Forbidden. Triggering token refresh...');
      final newUrl = await _onTokenExpired!();
      
      if (newUrl != null && newUrl != _currentRealUrl) {
        debugPrint('Token refreshed successfully. Reparsing playlist to update segment tokens...');
        updateRealUrl(newUrl, _currentHeaders);
        
        await _fetchAndParsePlaylist(newUrl);
        
        final freshSegmentUrl = _segmentMap[key];
        
        if (freshSegmentUrl != null && freshSegmentUrl != actualUrl) {
          debugPrint('Retrying segment download with fresh token...');
          success = await _streamSegment(freshSegmentUrl, request.response);
        } else {
          debugPrint('Segment no longer in the live window after refresh.');
        }
      }
    }

    if (!success) {
      if (request.response.connectionInfo != null) {
        request.response.statusCode = HttpStatus.forbidden;
        await request.response.close();
      }
    }
  }

  Future<bool> _streamSegment(String url, HttpResponse response) async {
    try {
      final dioResponse = await _dio.get<ResponseBody>(
        url,
        options: Options(
          responseType: ResponseType.stream,
          headers: _currentHeaders,
        ),
      );

      if (dioResponse.statusCode == 403 || dioResponse.statusCode == 401) {
        return false;
      }
      
      if (dioResponse.statusCode != 200 && dioResponse.statusCode != 206) {
         if (response.connectionInfo != null) {
           response.statusCode = dioResponse.statusCode ?? 500;
           await response.close();
         }
         return true;
      }

      response.statusCode = HttpStatus.ok;
      response.headers.contentType = ContentType('video', 'MP2T');
      response.headers.add('Access-Control-Allow-Origin', '*');

      await dioResponse.data!.stream.cast<List<int>>().pipe(response);
      return true;
    } catch (e) {
      debugPrint('Error streaming segment: $e');
      if (response.connectionInfo != null) {
         response.statusCode = HttpStatus.internalServerError;
         await response.close();
      }
      return true; 
    }
  }
}
