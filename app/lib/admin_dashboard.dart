import 'dart:convert';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class AdminDashboardPage extends StatefulWidget {
  final String baseUrl;
  final String apiKey;

  const AdminDashboardPage({super.key, required this.baseUrl, required this.apiKey});

  @override
  State<AdminDashboardPage> createState() => _AdminDashboardPageState();
}

class _AdminDashboardPageState extends State<AdminDashboardPage> {
  final TextEditingController _qCtrl = TextEditingController();
  List<_AdminArticle> _items = <_AdminArticle>[];
  List<String> _categories = <String>[];
  String _category = 'Toate';
  bool _loading = true;
  final int _tabIndex = 0;
  static const Duration _httpTimeout = Duration(seconds: 7);

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  @override
  void dispose() {
    _qCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadInitial() async {
    await Future.wait(<Future<void>>[
      _loadCategories(),
      _loadArticles(),
    ]);
  }

  Future<void> _loadCategories() async {
    try {
      final Uri uri = Uri.parse('${widget.baseUrl}/categories');
      final http.Response resp = await http.get(uri).timeout(_httpTimeout);
      if (resp.statusCode == 200) {
        final List<dynamic> data = jsonDecode(resp.body) as List<dynamic>;
        setState(() {
          _categories = data.cast<String>();
          if (!_categories.contains(_category)) _category = _categories.first;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadArticles() async {
    setState(() => _loading = true);
    try {
      final Map<String, String> qp = <String, String>{
        if (_qCtrl.text.trim().isNotEmpty) 'q': _qCtrl.text.trim(),
        if (_category != 'Toate') 'category': _category,
        'limit': '100',
      };
      final Uri uri = Uri.parse('${widget.baseUrl}/articles').replace(queryParameters: qp);
      final http.Response resp = await http.get(uri).timeout(_httpTimeout);
      if (resp.statusCode != 200) {
        throw Exception('Cod ${resp.statusCode}');
      }
      final List<dynamic> data = jsonDecode(resp.body) as List<dynamic>;
      final List<_AdminArticle> items = data.map<_AdminArticle>((dynamic e) => _AdminArticle.fromJson(e as Map<String, dynamic>)).toList();
      setState(() => _items = items);
    } catch (e) {
      // fallback demo articles
      setState(() => _items = <_AdminArticle>[]);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _delete(String id) async {
    try {
      final Uri uri = Uri.parse('${widget.baseUrl}/articles/$id');
      final http.Response resp = await http
          .delete(uri, headers: <String, String>{'x-api-key': widget.apiKey})
          .timeout(_httpTimeout);
      if (resp.statusCode != 204) {
        throw Exception('Cod ${resp.statusCode}');
      }
      await _loadArticles();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Șters')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Eroare la ștergere: $e')),
        );
      }
    }
  }

  Future<void> _openCreate() async {
    final _AdminArticle? created = await Navigator.of(context).push<_AdminArticle>(
      MaterialPageRoute<_AdminArticle>(
         builder: (BuildContext context) => _AdminEditPage(
           baseUrl: widget.baseUrl,
           apiKey: widget.apiKey,
           categories: _categories.where((String c) => c != 'Toate').toList(),
         ),
      ),
    );
    if (created != null) {
      await _loadArticles();
    }
  }

  Future<void> _openEdit(_AdminArticle article) async {
    final _AdminArticle? updated = await Navigator.of(context).push<_AdminArticle>(
      MaterialPageRoute<_AdminArticle>(
         builder: (BuildContext context) => _AdminEditPage(
           baseUrl: widget.baseUrl,
           apiKey: widget.apiKey,
           categories: _categories.where((String c) => c != 'Toate').toList(),
           existing: article,
         ),
      ),
    );
    if (updated != null) {
      await _loadArticles();
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 5,
      initialIndex: _tabIndex,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Admin'),
          bottom: const TabBar(
            isScrollable: true,
            tabs: <Widget>[
              Tab(icon: Icon(Icons.article_outlined), text: 'Articole'),
              Tab(icon: Icon(Icons.category_outlined), text: 'Categorii'),
              Tab(icon: Icon(Icons.topic_outlined), text: 'Topicuri'),
              Tab(icon: Icon(Icons.campaign_outlined), text: 'Anunțuri'),
              Tab(icon: Icon(Icons.smart_toy_outlined), text: 'Gemini'),
            ],
          ),
        ),
        body: TabBarView(
          children: <Widget>[
            _ArticlesTab(
              qCtrl: _qCtrl,
              categories: _categories,
              category: _category,
              items: _items,
              loading: _loading,
              onCategoryChanged: (String v) => setState(() => _category = v),
              reloadCategories: _loadCategories,
              reloadArticles: _loadArticles,
              openCreate: _openCreate,
              openEdit: _openEdit,
              onDelete: _delete,
            ),
            _CategoriesTab(baseUrl: widget.baseUrl, apiKey: widget.apiKey),
            _TopicsTab(baseUrl: widget.baseUrl, apiKey: widget.apiKey),
            _AnnouncementsTab(baseUrl: widget.baseUrl, apiKey: widget.apiKey),
            _GeminiTab(baseUrl: widget.baseUrl, apiKey: widget.apiKey),
          ],
        ),
        floatingActionButton: Builder(
          builder: (BuildContext context) {
            final int tab = DefaultTabController.of(context).index;
            if (tab == 0) {
              return FloatingActionButton.extended(onPressed: _openCreate, icon: const Icon(Icons.add), label: const Text('Adaugă'));
            }
            return const SizedBox.shrink();
          },
        ),
      ),
    );
  }
}

class _AdminArticle {
  final String id;
  final String title;
  final String summary;
  final String imageUrl;
  final String source;
  final String category;
  final DateTime? publishedAt;

  _AdminArticle({
    required this.id,
    required this.title,
    required this.summary,
    required this.imageUrl,
    required this.source,
    required this.category,
    required this.publishedAt,
  });

  factory _AdminArticle.fromJson(Map<String, dynamic> json) {
    return _AdminArticle(
      id: json['id'] as String,
      title: json['title'] as String,
      summary: json['summary'] as String,
      imageUrl: json['image_url'] as String,
      source: json['source'] as String,
      category: json['category'] as String,
      publishedAt: json['published_at'] != null ? DateTime.tryParse(json['published_at'] as String) : null,
    );
  }
}

class _AdminEditPage extends StatefulWidget {
  final String baseUrl;
  final String apiKey;
  final List<String> categories;
  final _AdminArticle? existing;

  const _AdminEditPage({
    required this.baseUrl,
    required this.apiKey,
    required this.categories,
    this.existing,
  });

  @override
  State<_AdminEditPage> createState() => _AdminEditPageState();
}

class _AdminEditPageState extends State<_AdminEditPage> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleCtrl;
  late final TextEditingController _summaryCtrl;
  late final TextEditingController _imageUrlCtrl;
  late final TextEditingController _sourceCtrl;
  late final TextEditingController _publishedCtrl;
  String? _category;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _titleCtrl = TextEditingController(text: widget.existing?.title ?? '');
    _summaryCtrl = TextEditingController(text: widget.existing?.summary ?? '');
    _imageUrlCtrl = TextEditingController(text: widget.existing?.imageUrl ?? 'https://picsum.photos/800/450');
    _sourceCtrl = TextEditingController(text: widget.existing?.source ?? 'Stirix');
    _publishedCtrl = TextEditingController(text: widget.existing?.publishedAt?.toUtc().toIso8601String() ?? '');
    _category = widget.existing?.category ?? (widget.categories.isNotEmpty ? widget.categories.first : 'Tech');
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _summaryCtrl.dispose();
    _imageUrlCtrl.dispose();
    _sourceCtrl.dispose();
    _publishedCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final Map<String, dynamic> body = <String, dynamic>{
        'title': _titleCtrl.text.trim(),
        'summary': _summaryCtrl.text.trim(),
        'image_url': _imageUrlCtrl.text.trim(),
        'source': _sourceCtrl.text.trim(),
        'category': _category ?? 'Tech',
        if (_publishedCtrl.text.trim().isNotEmpty) 'published_at': DateTime.parse(_publishedCtrl.text.trim()).toUtc().toIso8601String(),
      };

      final Map<String, String> headers = <String, String>{
        'Content-Type': 'application/json',
        'x-api-key': widget.apiKey,
      };

      if (widget.existing == null) {
        final Uri uri = Uri.parse('${widget.baseUrl}/articles');
        final http.Response resp = await http.post(uri, headers: headers, body: jsonEncode(body));
        if (resp.statusCode != 200) throw Exception('Cod ${resp.statusCode}');
        final Map<String, dynamic> data = jsonDecode(resp.body) as Map<String, dynamic>;
        if (!mounted) return;
        Navigator.of(context).pop<_AdminArticle>(_AdminArticle.fromJson(data));
      } else {
        final Uri uri = Uri.parse('${widget.baseUrl}/articles/${widget.existing!.id}');
        final http.Response resp = await http.put(uri, headers: headers, body: jsonEncode(body));
        if (resp.statusCode != 200) throw Exception('Cod ${resp.statusCode}');
        final Map<String, dynamic> data = jsonDecode(resp.body) as Map<String, dynamic>;
        if (!mounted) return;
        Navigator.of(context).pop<_AdminArticle>(_AdminArticle.fromJson(data));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Eroare la salvare: $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(widget.existing == null ? 'Adaugă articol' : 'Editează articol')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: <Widget>[
            TextFormField(
              controller: _titleCtrl,
              decoration: const InputDecoration(labelText: 'Titlu', border: OutlineInputBorder()),
              validator: (String? v) => (v == null || v.trim().isEmpty) ? 'Introdu un titlu' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _summaryCtrl,
              maxLines: 5,
              decoration: const InputDecoration(labelText: 'Rezumat', border: OutlineInputBorder()),
              validator: (String? v) => (v == null || v.trim().length < 10) ? 'Minim 10 caractere' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _imageUrlCtrl,
              decoration: const InputDecoration(labelText: 'Imagine URL', border: OutlineInputBorder()),
              validator: (String? v) => (v == null || !v.startsWith('http')) ? 'Introdu un URL valid' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _sourceCtrl,
              decoration: const InputDecoration(labelText: 'Sursă', border: OutlineInputBorder()),
              validator: (String? v) => (v == null || v.trim().isEmpty) ? 'Introdu sursa' : null,
            ),
            const SizedBox(height: 12),
            InputDecorator(
              decoration: const InputDecoration(labelText: 'Categorie', border: OutlineInputBorder()),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _category,
                  isExpanded: true,
                  items: widget.categories
                      .map<DropdownMenuItem<String>>((String c) => DropdownMenuItem<String>(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (String? v) => setState(() => _category = v),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _publishedCtrl,
              decoration: const InputDecoration(
                labelText: 'Publicat la (ISO8601, opțional)',
                hintText: 'YYYY-MM-DDTHH:MM:SSZ',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: _saving ? null : _submit,
              icon: _saving
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.check),
              label: Text(_saving ? 'Se salvează...' : (widget.existing == null ? 'Publică' : 'Salvează')),
            ),
            const SizedBox(height: 8),
            Text(
              'Articolul va fi salvat în baza de date. Campul „Publicat la” este opțional.',
              style: text.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}


class _GeminiTab extends StatefulWidget {
  final String baseUrl;
  final String apiKey;
  const _GeminiTab({required this.baseUrl, required this.apiKey});
  @override
  State<_GeminiTab> createState() => _GeminiTabState();
}

class _GeminiTabState extends State<_GeminiTab> {
  static const Duration _httpTimeout = Duration(seconds: 7);
  List<_AdminTopic> _topics = <_AdminTopic>[];
  Map<String, _TopicStatus> _topicStatuses = <String, _TopicStatus>{};
  bool _loading = true;
  late final TextEditingController _keyCtrl;
  bool _savingKey = false;
  bool _obscure = true;

  Timer? _timer;
  Duration _elapsed = Duration.zero;
  bool _running = false;
  List<Map<String, dynamic>> _logs = <Map<String, dynamic>>[];
  int _itemsCreated = 0;
  String? _lastError;
  String? _currentTopic;
  int _secTick = 0;
  bool _isPolling = false;

  @override
  void initState() {
    super.initState();
    _keyCtrl = TextEditingController();
    _reload();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _keyCtrl.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    setState(() => _loading = true);
    try {
      final http.Response t = await http.get(Uri.parse('${widget.baseUrl}/topics')).timeout(_httpTimeout);
      if (t.statusCode == 200) {
        final List<dynamic> data = jsonDecode(t.body) as List<dynamic>;
        _topics = data.map<_AdminTopic>((dynamic e) => _AdminTopic.fromJson(e as Map<String, dynamic>)).toList();
      }

      // Load topic statuses for LED indicators
      final http.Response ts = await http.get(Uri.parse('${widget.baseUrl}/topics/statuses')).timeout(_httpTimeout);
      if (ts.statusCode == 200) {
        final List<dynamic> data = jsonDecode(ts.body) as List<dynamic>;
        _topicStatuses = <String, _TopicStatus>{
          for (final dynamic e in data)
            (e as Map<String, dynamic>)['topic_id'] as String: _TopicStatus.fromJson(e as Map<String, dynamic>),
        };
      }

      final http.Response k = await http.get(Uri.parse('${widget.baseUrl}/settings/gemini-key')).timeout(_httpTimeout);
      if (k.statusCode == 200) {
        final Map<String, dynamic> jd = jsonDecode(k.body) as Map<String, dynamic>;
        _keyCtrl.text = (jd['gemini_api_key'] as String?) ?? '';
      }

      // Load autoposter status
      final http.Response s = await http.get(Uri.parse('${widget.baseUrl}/autoposter/status')).timeout(_httpTimeout);
      if (s.statusCode == 200) {
        final Map<String, dynamic> st = jsonDecode(s.body) as Map<String, dynamic>;
        final bool running = (st['running'] as bool?) ?? false;
        final String? startedAt = st['started_at'] as String?;
        _itemsCreated = (st['items_created'] as int?) ?? 0;
        _lastError = st['last_error'] as String?;
        _currentTopic = st['current_topic'] as String?;
        _timer?.cancel();
        _running = running;
        if (running && startedAt != null && startedAt.isNotEmpty) {
          final DateTime sa = DateTime.tryParse(startedAt) ?? DateTime.now().toUtc();
          _elapsed = DateTime.now().toUtc().difference(sa).abs();
          _secTick = 0;
          _timer = Timer.periodic(const Duration(seconds: 1), (_) async {
            if (!mounted) return;
            setState(() {
              _elapsed += const Duration(seconds: 1);
              _secTick = (_secTick + 1) % 3600;
            });
            if (_running && _secTick % 5 == 0) {
              await _pollStatusAndLogs();
            }
          });
        } else {
          _elapsed = Duration.zero;
        }
      }

      // Load logs
      final http.Response lg = await http.get(Uri.parse('${widget.baseUrl}/autoposter/logs')).timeout(_httpTimeout);
      if (lg.statusCode == 200) {
        final Map<String, dynamic> jdl = jsonDecode(lg.body) as Map<String, dynamic>;
        final List<dynamic> arr = jdl['logs'] as List<dynamic>? ?? <dynamic>[];
        _logs = arr.cast<Map<String, dynamic>>();
      }

      if (mounted) setState(() {});
    } catch (_) {
      _topics = <_AdminTopic>[];
      if (mounted) setState(() {});
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pollStatusAndLogs() async {
    if (_isPolling) return;
    _isPolling = true;
    try {
      final http.Response s = await http.get(Uri.parse('${widget.baseUrl}/autoposter/status')).timeout(_httpTimeout);
      if (s.statusCode == 200) {
        final Map<String, dynamic> st = jsonDecode(s.body) as Map<String, dynamic>;
        final bool running = (st['running'] as bool?) ?? false;
        _itemsCreated = (st['items_created'] as int?) ?? _itemsCreated;
        _lastError = st['last_error'] as String?;
        _currentTopic = st['current_topic'] as String?;
        if (!mounted) return;
        setState(() => _running = running);
      }
      final http.Response lg = await http.get(Uri.parse('${widget.baseUrl}/autoposter/logs')).timeout(_httpTimeout);
      if (lg.statusCode == 200 && mounted) {
        final Map<String, dynamic> jdl = jsonDecode(lg.body) as Map<String, dynamic>;
        final List<dynamic> arr = jdl['logs'] as List<dynamic>? ?? <dynamic>[];
        setState(() => _logs = arr.cast<Map<String, dynamic>>());
      }
    } catch (_) {
      // ignore polling errors
    } finally {
      _isPolling = false;
    }
  }

  Future<void> _start() async {
    if (_running) return;
    try {
      final Uri uri = Uri.parse('${widget.baseUrl}/autoposter/start');
      final http.Response resp = await http
          .post(
            uri,
            headers: <String, String>{'x-api-key': widget.apiKey, 'Content-Type': 'application/json'},
          )
          .timeout(const Duration(seconds: 20));
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        final Map<String, dynamic> st = jsonDecode(resp.body) as Map<String, dynamic>;
        final String? startedAt = st['started_at'] as String?;
        _timer?.cancel();
        _elapsed = Duration.zero;
        if (startedAt != null && startedAt.isNotEmpty) {
          final DateTime sa = DateTime.tryParse(startedAt) ?? DateTime.now().toUtc();
          _elapsed = DateTime.now().toUtc().difference(sa).abs();
        }
        setState(() => _running = true);
        _secTick = 0;
        _timer = Timer.periodic(const Duration(seconds: 1), (_) async {
          if (!mounted) return;
          setState(() {
            _elapsed += const Duration(seconds: 1);
            _secTick = (_secTick + 1) % 3600;
          });
          if (_running && _secTick % 5 == 0) {
            await _pollStatusAndLogs();
          }
        });
        await _reload();
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Eroare start: ${resp.statusCode}')));
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Eroare start: $e')));
      }
    }
  }

  Future<void> _stop() async {
    try {
      final Uri uri = Uri.parse('${widget.baseUrl}/autoposter/stop');
      final http.Response resp = await http
          .post(
            uri,
            headers: <String, String>{'x-api-key': widget.apiKey, 'Content-Type': 'application/json'},
          )
          .timeout(const Duration(seconds: 20));
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        _timer?.cancel();
        setState(() => _running = false);
        await _reload();
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Eroare stop: ${resp.statusCode}')));
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Eroare stop: $e')));
      }
    }
  }

  Future<void> _reset() async {
    try {
      final Uri uri = Uri.parse('${widget.baseUrl}/autoposter/reset');
      final http.Response resp = await http
          .post(
            uri,
            headers: <String, String>{'x-api-key': widget.apiKey, 'Content-Type': 'application/json'},
          )
          .timeout(const Duration(seconds: 20));
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        _elapsed = Duration.zero;
        if (mounted) {
          setState(() {
            _logs = <Map<String, dynamic>>[];
            _itemsCreated = 0;
            _lastError = null;
            _currentTopic = null;
          });
        }
        await _reload();
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Eroare reset: ${resp.statusCode}')));
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Eroare reset: $e')));
      }
    }
  }

  String _format(Duration d) {
    String two(int n) => n.toString().padLeft(2, '0');
    final int h = d.inHours;
    final int m = d.inMinutes.remainder(60);
    final int s = d.inSeconds.remainder(60);
    return '${two(h)}:${two(m)}:${two(s)}';
  }

  Color _ledColorFor(_AdminTopic t, ColorScheme colors) {
    final _TopicStatus? s = _topicStatuses[t.id];
    final DateTime now = DateTime.now().toUtc();
    if (s != null) {
      if (s.lastPostedAt != null && now.difference(s.lastPostedAt!).inHours < 24) {
        return Colors.blue;
      }
      if (s.lastResult == 'error' && s.updatedAt != null && now.difference(s.updatedAt!).inHours < 24) {
        return colors.error;
      }
    }
    return Colors.green;
  }

  Future<void> _saveKey() async {
    setState(() => _savingKey = true);
    try {
      final Uri uri = Uri.parse('${widget.baseUrl}/settings/gemini-key');
      final http.Response resp = await http
          .put(
            uri,
            headers: <String, String>{'Content-Type': 'application/json', 'x-api-key': widget.apiKey},
            body: jsonEncode(<String, dynamic>{'gemini_api_key': _keyCtrl.text.trim()}),
          )
          .timeout(_httpTimeout);
      if (!mounted) return;
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Cheia Gemini a fost salvată')));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Eroare la salvare: cod ${resp.statusCode}')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Eroare la salvare: $e')));
      }
    } finally {
      if (mounted) setState(() => _savingKey = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final ColorScheme colors = Theme.of(context).colorScheme;
    if (_loading) return const Center(child: CircularProgressIndicator());
    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Text('Previzualizare topicuri', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
              FilledButton.tonal(onPressed: _reload, child: const Text('Reîncarcă')),
            ],
          ),
        ),
        SizedBox(
          height: 140,
          child: _topics.isEmpty
              ? Center(child: Text('Nu există topicuri', style: text.bodyMedium))
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  scrollDirection: Axis.horizontal,
                  itemCount: _topics.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (BuildContext context, int index) {
                    final _AdminTopic t = _topics[index];
                    return SizedBox(
                      width: 240,
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Row(children: <Widget>[
                                Container(width: 10, height: 10, decoration: BoxDecoration(color: _ledColorFor(t, colors), shape: BoxShape.circle)),
                                const SizedBox(width: 6),
                                const Icon(Icons.topic_outlined, size: 18),
                                const SizedBox(width: 6),
                                Expanded(child: Text(t.name, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis)),
                              ]),
                              const SizedBox(height: 6),
                              Text(t.description ?? '-', maxLines: 3, overflow: TextOverflow.ellipsis, style: text.bodySmall),
                              const Spacer(),
                              if (t.createdAt != null)
                                Text('Creat: ${t.createdAt!.toIso8601String()}', style: text.labelSmall?.copyWith(color: colors.onSurfaceVariant)),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
            decoration: BoxDecoration(
              color: colors.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: <Widget>[
                Text(_format(_elapsed), style: text.displaySmall?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Text('Status: ${_running ? 'Pornit' : 'Oprit'} • Articole create: $_itemsCreated${_currentTopic != null ? ' • Topic: $_currentTopic' : ''}', style: text.bodySmall),
                if (_lastError != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text('Ultima eroare: $_lastError', style: text.bodySmall?.copyWith(color: colors.error))),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    FilledButton.icon(onPressed: _running ? null : _start, icon: const Icon(Icons.play_arrow), label: const Text('Start')),
                    const SizedBox(width: 8),
                    FilledButton.icon(onPressed: _running ? _stop : null, icon: const Icon(Icons.stop), label: const Text('Stop')),
                    const SizedBox(width: 8),
                    FilledButton.tonalIcon(onPressed: _reset, icon: const Icon(Icons.restart_alt), label: const Text('Reset')),
                  ],
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Jurnale recente', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                ),
                const SizedBox(height: 6),
                SizedBox(
                  height: 120,
                  child: _logs.isEmpty
                      ? Center(child: Text('Fără evenimente', style: text.bodySmall))
                      : ListView.builder(
                          itemCount: _logs.length.clamp(0, 20),
                          itemBuilder: (BuildContext context, int index) {
                            final Map<String, dynamic> e = _logs.reversed.elementAt(index);
                            final String level = (e['level'] as String? ?? '').toUpperCase();
                            final String ts = (e['ts'] as String?) ?? '';
                            final String msg = (e['message'] as String?) ?? '';
                            Color c = colors.onSurfaceVariant;
                            if (level == 'ERROR') c = colors.error;
                            if (level == 'WARNING') c = colors.tertiary;
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 2),
                              child: Row(children: <Widget>[
                                Text('[$level]', style: text.labelSmall?.copyWith(color: c)),
                                const SizedBox(width: 6),
                                Expanded(child: Text('$ts – $msg', style: text.labelSmall?.copyWith(color: colors.onSurfaceVariant), overflow: TextOverflow.ellipsis)),
                              ]),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text('Gemini API Key', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _keyCtrl,
                obscureText: _obscure,
                decoration: InputDecoration(
                  labelText: 'Introduceți cheia API',
                  border: const OutlineInputBorder(),
                  suffixIcon: IconButton(
                    onPressed: () => setState(() => _obscure = !_obscure),
                    icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: FilledButton.icon(
                  onPressed: _savingKey ? null : _saveKey,
                  icon: _savingKey
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.save_outlined),
                  label: Text(_savingKey ? 'Se salvează…' : 'Salvează'),
                ),
              ),
              const SizedBox(height: 12),
              Text('Cheia este stocată în baza de date și va rămâne persistentă.', style: text.bodySmall),
            ],
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}



class _ArticlesTab extends StatelessWidget {
  final TextEditingController qCtrl;
  final List<String> categories;
  final String category;
  final List<_AdminArticle> items;
  final bool loading;
  final ValueChanged<String> onCategoryChanged;
  final Future<void> Function() reloadCategories;
  final Future<void> Function() reloadArticles;
  final Future<void> Function() openCreate;
  final Future<void> Function(_AdminArticle) openEdit;
  final Future<void> Function(String) onDelete;

  const _ArticlesTab({
    required this.qCtrl,
    required this.categories,
    required this.category,
    required this.items,
    required this.loading,
    required this.onCategoryChanged,
    required this.reloadCategories,
    required this.reloadArticles,
    required this.openCreate,
    required this.openEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            children: <Widget>[
              Expanded(
                child: TextField(
                  controller: qCtrl,
                  decoration: InputDecoration(
                    hintText: 'Caută titlu sau rezumat…',
                    prefixIcon: const Icon(Icons.search),
                    border: const OutlineInputBorder(),
                    isDense: true,
                    suffixIcon: (qCtrl.text.isNotEmpty)
                        ? IconButton(
                            onPressed: () {
                              qCtrl.clear();
                              reloadArticles();
                            },
                            icon: const Icon(Icons.clear),
                          )
                        : null,
                  ),
                  onSubmitted: (_) => reloadArticles(),
                ),
              ),
              const SizedBox(width: 8),
              DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: category,
                  items: (categories.isEmpty ? <String>['Toate'] : categories)
                      .map<DropdownMenuItem<String>>((String c) => DropdownMenuItem<String>(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (String? v) {
                    if (v == null) return;
                    onCategoryChanged(v);
                    reloadArticles();
                  },
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.tonal(onPressed: reloadArticles, child: const Text('Aplică')),
            ],
          ),
        ),
        Expanded(
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: reloadArticles,
                  child: ListView.separated(
                    padding: const EdgeInsets.only(bottom: 96, left: 8, right: 8, top: 8),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (BuildContext context, int index) {
                      final _AdminArticle a = items[index];
                      return Card(
                        child: ListTile(
                          leading: CircleAvatar(radius: 18, child: Text(a.source.isNotEmpty ? a.source[0].toUpperCase() : '?')),
                          title: Text(a.title, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                          subtitle: Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            children: <Widget>[
                              _Chip(text: a.category, icon: Icons.label_outline),
                              if (a.publishedAt != null) _Chip(text: a.publishedAt!.toIso8601String(), icon: Icons.schedule),
                            ],
                          ),
                          isThreeLine: true,
                          trailing: Wrap(
                            spacing: 4,
                            children: <Widget>[
                              IconButton(icon: const Icon(Icons.edit_outlined), tooltip: 'Editează', onPressed: () => openEdit(a)),
                              IconButton(
                                icon: const Icon(Icons.delete_outline),
                                tooltip: 'Șterge',
                                onPressed: () async {
                                  final bool? confirm = await showDialog<bool>(
                                    context: context,
                                    builder: (BuildContext context) => AlertDialog(
                                      title: const Text('Confirmă ștergerea'),
                                      content: Text('Ștergi "${a.title}"?'),
                                      actions: <Widget>[
                                        TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Anulează')),
                                        FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Șterge')),
                                      ],
                                    ),
                                  );
                                  if (confirm == true) await onDelete(a.id);
                                },
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}

class _CategoriesTab extends StatefulWidget {
  final String baseUrl;
  final String apiKey;
  const _CategoriesTab({required this.baseUrl, required this.apiKey});
  @override
  State<_CategoriesTab> createState() => _CategoriesTabState();
}

class _CategoriesTabState extends State<_CategoriesTab> {
  List<_AdminCategory> _categories = <_AdminCategory>[];
  bool _loading = true;
  static const Duration _httpTimeout = Duration(seconds: 7);

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    setState(() => _loading = true);
    try {
      final Uri uri = Uri.parse('${widget.baseUrl}/categories/raw');
      final http.Response resp = await http.get(uri).timeout(_httpTimeout);
      if (resp.statusCode == 200) {
        final List<dynamic> data = jsonDecode(resp.body) as List<dynamic>;
        setState(() {
          _categories = data.map<_AdminCategory>((dynamic e) => _AdminCategory.fromJson(e as Map<String, dynamic>)).toList();
        });
      }
    } catch (_) {
      setState(() {
        _categories = <_AdminCategory>[];
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createOrEdit({_AdminCategory? existing}) async {
    final TextEditingController ctrl = TextEditingController(text: existing?.name ?? '');
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: Text(existing == null ? 'Adaugă categorie' : 'Editează categorie'),
        content: TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'Nume categorie')),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Anulează')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Salvează')),
        ],
      ),
    );
    if (ok != true) return;
    final Map<String, String> headers = <String, String>{'Content-Type': 'application/json', 'x-api-key': widget.apiKey};
    if (existing == null) {
      final Uri uri = Uri.parse('${widget.baseUrl}/categories');
      await http
          .post(uri, headers: headers, body: jsonEncode(<String, dynamic>{'name': ctrl.text.trim()}))
          .timeout(_httpTimeout);
    } else {
      final Uri uri = Uri.parse('${widget.baseUrl}/categories/${existing.id}');
      await http
          .put(uri, headers: headers, body: jsonEncode(<String, dynamic>{'name': ctrl.text.trim()}))
          .timeout(_httpTimeout);
    }
    await _reload();
  }

  Future<void> _delete(_AdminCategory category) async {
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Șterge categorie'),
        content: Text('Ștergi "${category.name}"?'),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Anulează')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Șterge')),
        ],
      ),
    );
    if (confirm != true) return;
    final Uri uri = Uri.parse('${widget.baseUrl}/categories/${category.id}');
    await http.delete(uri, headers: <String, String>{'x-api-key': widget.apiKey}).timeout(_httpTimeout);
    await _reload();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: <Widget>[
              FilledButton.icon(onPressed: () => _createOrEdit(), icon: const Icon(Icons.add), label: const Text('Adaugă categorie')),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: _categories.length,
            itemBuilder: (BuildContext context, int index) {
              final _AdminCategory c = _categories[index];
              return Card(
                child: ListTile(
                  title: Text(c.name),
                  leading: const Icon(Icons.category_outlined),
                  trailing: Wrap(spacing: 4, children: <Widget>[
                    IconButton(icon: const Icon(Icons.edit_outlined), onPressed: () => _createOrEdit(existing: c)),
                    IconButton(icon: const Icon(Icons.delete_outline), onPressed: () => _delete(c)),
                  ]),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _TopicsTab extends StatefulWidget {
  final String baseUrl;
  final String apiKey;
  const _TopicsTab({required this.baseUrl, required this.apiKey});
  @override
  State<_TopicsTab> createState() => _TopicsTabState();
}

class _TopicsTabState extends State<_TopicsTab> {
  List<_AdminTopic> _topics = <_AdminTopic>[];
  bool _loading = true;
  static const Duration _httpTimeout = Duration(seconds: 7);

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    setState(() => _loading = true);
    try {
      final Uri uri = Uri.parse('${widget.baseUrl}/topics');
      final http.Response resp = await http.get(uri).timeout(_httpTimeout);
      if (resp.statusCode == 200) {
        final List<dynamic> data = jsonDecode(resp.body) as List<dynamic>;
        setState(() {
          _topics = data.map<_AdminTopic>((dynamic e) => _AdminTopic.fromJson(e as Map<String, dynamic>)).toList();
        });
      }
    } catch (_) {
      setState(() {
        _topics = <_AdminTopic>[];
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createOrEdit({_AdminTopic? existing}) async {
    final TextEditingController nameCtrl = TextEditingController(text: existing?.name ?? '');
    final TextEditingController descCtrl = TextEditingController(text: existing?.description ?? '');
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: Text(existing == null ? 'Adaugă topic' : 'Editează topic'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Nume topic')),
            const SizedBox(height: 8),
            TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'Descriere'), maxLines: 3),
          ],
        ),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Anulează')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Salvează')),
        ],
      ),
    );
    if (ok != true) return;
    final Map<String, String> headers = <String, String>{'Content-Type': 'application/json', 'x-api-key': widget.apiKey};
    if (existing == null) {
      await http
          .post(Uri.parse('${widget.baseUrl}/topics'), headers: headers, body: jsonEncode(<String, dynamic>{'name': nameCtrl.text.trim(), 'description': descCtrl.text.trim()}))
          .timeout(_httpTimeout);
    } else {
      await http
          .put(Uri.parse('${widget.baseUrl}/topics/${existing.id}'), headers: headers, body: jsonEncode(<String, dynamic>{'name': nameCtrl.text.trim(), 'description': descCtrl.text.trim()}))
          .timeout(_httpTimeout);
    }
    await _reload();
  }

  Future<void> _delete(_AdminTopic topic) async {
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Șterge topic'),
        content: Text('Ștergi "${topic.name}"?'),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Anulează')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Șterge')),
        ],
      ),
    );
    if (confirm != true) return;
    await http
        .delete(Uri.parse('${widget.baseUrl}/topics/${topic.id}'), headers: <String, String>{'x-api-key': widget.apiKey})
        .timeout(_httpTimeout);
    await _reload();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final TextTheme text = Theme.of(context).textTheme;
    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: <Widget>[
            FilledButton.icon(onPressed: () => _createOrEdit(), icon: const Icon(Icons.add), label: const Text('Adaugă topic')),
          ]),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.all(8),
            itemBuilder: (BuildContext context, int index) {
              final _AdminTopic t = _topics[index];
              return Card(
                child: ListTile(
                  title: Text(t.name, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                  subtitle: Text(t.description ?? '-', maxLines: 2, overflow: TextOverflow.ellipsis),
                  leading: const Icon(Icons.topic_outlined),
                  trailing: Wrap(spacing: 4, children: <Widget>[
                    IconButton(icon: const Icon(Icons.edit_outlined), onPressed: () => _createOrEdit(existing: t)),
                    IconButton(icon: const Icon(Icons.delete_outline), onPressed: () => _delete(t)),
                  ]),
                ),
              );
            },
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemCount: _topics.length,
          ),
        ),
      ],
    );
  }
}

class _AnnouncementsTab extends StatefulWidget {
  final String baseUrl;
  final String apiKey;
  const _AnnouncementsTab({required this.baseUrl, required this.apiKey});
  @override
  State<_AnnouncementsTab> createState() => _AnnouncementsTabState();
}

class _AnnouncementsTabState extends State<_AnnouncementsTab> {
  List<_AdminAnnouncement> _items = <_AdminAnnouncement>[];
  List<_AdminTopic> _topics = <_AdminTopic>[];
  bool _loading = true;
  static const Duration _httpTimeout = Duration(seconds: 7);

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    setState(() => _loading = true);
    try {
      final http.Response a = await http.get(Uri.parse('${widget.baseUrl}/announcements')).timeout(_httpTimeout);
      final http.Response t = await http.get(Uri.parse('${widget.baseUrl}/topics')).timeout(_httpTimeout);
      if (a.statusCode == 200) {
        final List<dynamic> data = jsonDecode(a.body) as List<dynamic>;
        _items = data.map<_AdminAnnouncement>((dynamic e) => _AdminAnnouncement.fromJson(e as Map<String, dynamic>)).toList();
      }
      if (t.statusCode == 200) {
        final List<dynamic> data = jsonDecode(t.body) as List<dynamic>;
        _topics = data.map<_AdminTopic>((dynamic e) => _AdminTopic.fromJson(e as Map<String, dynamic>)).toList();
      }
      if (mounted) setState(() {});
    } catch (_) {
      _topics = <_AdminTopic>[];
      _items = <_AdminAnnouncement>[];
      if (mounted) setState(() {});
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createOrEdit({_AdminAnnouncement? existing}) async {
    final TextEditingController titleCtrl = TextEditingController(text: existing?.title ?? '');
    final TextEditingController contentCtrl = TextEditingController(text: existing?.content ?? '');
    String? topic = existing?.topic;
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: Text(existing == null ? 'Adaugă anunț' : 'Editează anunț'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Titlu')),
              const SizedBox(height: 8),
              TextField(controller: contentCtrl, decoration: const InputDecoration(labelText: 'Conținut'), maxLines: 5),
              const SizedBox(height: 8),
              InputDecorator(
                decoration: const InputDecoration(labelText: 'Topic (opțional)', border: OutlineInputBorder()),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: topic,
                    isExpanded: true,
                    items: <DropdownMenuItem<String>>[
                      const DropdownMenuItem<String>(value: null, child: Text('— Fără —')),
                      ..._topics.map<DropdownMenuItem<String>>(( _AdminTopic t) => DropdownMenuItem<String>(value: t.name, child: Text(t.name)))
                    ],
                    onChanged: (String? v) => topic = v,
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Anulează')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Salvează')),
        ],
      ),
    );
    if (ok != true) return;
    final Map<String, String> headers = <String, String>{'Content-Type': 'application/json', 'x-api-key': widget.apiKey};
    final Map<String, dynamic> body = <String, dynamic>{'title': titleCtrl.text.trim(), 'content': contentCtrl.text.trim(), 'topic': topic};
    if (existing == null) {
      await http
          .post(Uri.parse('${widget.baseUrl}/announcements'), headers: headers, body: jsonEncode(body))
          .timeout(_httpTimeout);
    } else {
      await http
          .put(Uri.parse('${widget.baseUrl}/announcements/${existing.id}'), headers: headers, body: jsonEncode(body))
          .timeout(_httpTimeout);
    }
    await _reload();
  }

  Future<void> _delete(_AdminAnnouncement ann) async {
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Șterge anunț'),
        content: Text('Ștergi "${ann.title}"?'),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Anulează')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Șterge')),
        ],
      ),
    );
    if (confirm != true) return;
    await http
        .delete(Uri.parse('${widget.baseUrl}/announcements/${ann.id}'), headers: <String, String>{'x-api-key': widget.apiKey})
        .timeout(_httpTimeout);
    await _reload();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final TextTheme text = Theme.of(context).textTheme;
    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: <Widget>[
            FilledButton.icon(onPressed: () => _createOrEdit(), icon: const Icon(Icons.add), label: const Text('Adaugă anunț')),
          ]),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.all(8),
            itemCount: _items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (BuildContext context, int index) {
              final _AdminAnnouncement a = _items[index];
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.campaign_outlined),
                  title: Text(a.title, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                  subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                    if (a.topic != null) Padding(padding: const EdgeInsets.only(top: 4), child: _Chip(text: a.topic!, icon: Icons.topic_outlined)),
                    Padding(padding: const EdgeInsets.only(top: 4), child: Text(a.content, maxLines: 3, overflow: TextOverflow.ellipsis)),
                  ]),
                  trailing: Wrap(spacing: 4, children: <Widget>[
                    IconButton(icon: const Icon(Icons.edit_outlined), onPressed: () => _createOrEdit(existing: a)),
                    IconButton(icon: const Icon(Icons.delete_outline), onPressed: () => _delete(a)),
                  ]),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _AdminCategory {
  final String id;
  final String name;
  _AdminCategory({required this.id, required this.name});
  factory _AdminCategory.fromJson(Map<String, dynamic> json) => _AdminCategory(id: json['id'] as String, name: json['name'] as String);
}

class _AdminTopic {
  final String id;
  final String name;
  final String? description;
  final DateTime? createdAt;
  _AdminTopic({required this.id, required this.name, this.description, this.createdAt});
  factory _AdminTopic.fromJson(Map<String, dynamic> json) => _AdminTopic(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'] as String) : null,
      );
}

class _TopicStatus {
  final String topicId;
  final DateTime? lastPostedAt;
  final String? lastResult;
  final String? lastError;
  final DateTime? updatedAt;
  _TopicStatus({required this.topicId, this.lastPostedAt, this.lastResult, this.lastError, this.updatedAt});
  factory _TopicStatus.fromJson(Map<String, dynamic> json) => _TopicStatus(
        topicId: json['topic_id'] as String,
        lastPostedAt: json['last_posted_at'] != null ? DateTime.tryParse(json['last_posted_at'] as String) : null,
        lastResult: json['last_result'] as String?,
        lastError: json['last_error'] as String?,
        updatedAt: json['updated_at'] != null ? DateTime.tryParse(json['updated_at'] as String) : null,
      );
}

class _AdminAnnouncement {
  final String id;
  final String title;
  final String content;
  final String? topic;
  final DateTime? createdAt;
  _AdminAnnouncement({required this.id, required this.title, required this.content, this.topic, this.createdAt});
  factory _AdminAnnouncement.fromJson(Map<String, dynamic> json) => _AdminAnnouncement(
        id: json['id'] as String,
        title: json['title'] as String,
        content: json['content'] as String,
        topic: json['topic'] as String?,
        createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'] as String) : null,
      );
}

class _Chip extends StatelessWidget {
  final String text;
  final IconData icon;
  const _Chip({required this.text, required this.icon});
  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
        Icon(icon, size: 14, color: colors.onSurfaceVariant),
        const SizedBox(width: 6),
        Text(text, style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant)),
      ]),
    );
  }
}

// -------------------- Demo fallback data --------------------

// No demo fallbacks. The UI will display empty states if API is unavailable.

