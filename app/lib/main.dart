import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'admin_dashboard.dart';
import 'design.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Știri',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.light,
      theme: AppDesign.lightTheme,
      darkTheme: AppDesign.lightTheme,
      home: const NewsHomePage(),
    );
  }
}

class Article {
  final String id;
  final String title;
  final String summary;
  final String imageUrl;
  final String source;
  final DateTime publishedAt;
  final String category;

  const Article({
    required this.id,
    required this.title,
    required this.summary,
    required this.imageUrl,
    required this.source,
    required this.publishedAt,
    required this.category,
  });

  factory Article.fromJson(Map<String, dynamic> json) {
    return Article(
      id: json['id'] as String,
      title: json['title'] as String,
      summary: json['summary'] as String,
      imageUrl: json['image_url'] as String,
      source: json['source'] as String,
      publishedAt: DateTime.parse(json['published_at'] as String),
      category: json['category'] as String,
    );
  }

  Map<String, dynamic> toCreateJson() {
    return <String, dynamic>{
      'title': title,
      'summary': summary,
      'image_url': imageUrl,
      'source': source,
      'category': category,
      'published_at': publishedAt.toUtc().toIso8601String(),
    };
  }
}

const List<String> _fallbackCategories = <String>['Toate', 'Tech', 'Sport', 'Economie', 'Sănătate', 'Cultură'];

final List<Article> _mockArticles = <Article>[
  Article(
    id: '1',
    title: 'Noul update Android aduce funcții AI la îndemână',
    summary: 'Google lansează o serie de îmbunătățiri bazate pe AI pentru Android, '
        'axate pe productivitate și securitate.',
    imageUrl: 'https://picsum.photos/id/1015/800/450',
    source: 'TechToday',
    publishedAt: DateTime.now().subtract(const Duration(minutes: 42)),
    category: 'Tech',
  ),
  Article(
    id: '2',
    title: 'Echipa națională obține o victorie spectaculoasă',
    summary: 'Un meci intens s-a încheiat cu 3-2 după un gol marcat în prelungiri.',
    imageUrl: 'https://picsum.photos/id/1025/800/450',
    source: 'SportMag',
    publishedAt: DateTime.now().subtract(const Duration(hours: 2, minutes: 10)),
    category: 'Sport',
  ),
  Article(
    id: '3',
    title: 'Piața bursieră în creștere după anunțul BNR',
    summary: 'Investitorii reacționează pozitiv la noile măsuri de politică monetară.',
    imageUrl: 'https://picsum.photos/id/1035/800/450',
    source: 'EconoNews',
    publishedAt: DateTime.now().subtract(const Duration(hours: 5)),
    category: 'Economie',
  ),
  Article(
    id: '4',
    title: 'Cercetare nouă arată beneficiile somnului regulat',
    summary: 'Studiul subliniază legătura dintre somn și sănătatea mentală pe termen lung.',
    imageUrl: 'https://picsum.photos/id/1041/800/450',
    source: 'Sănătate Azi',
    publishedAt: DateTime.now().subtract(const Duration(hours: 8, minutes: 20)),
    category: 'Sănătate',
  ),
  Article(
    id: '5',
    title: 'Festivalul de film aduce premiere așteptate',
    summary: 'Regizori și actori celebri participă la evenimentul cultural al toamnei.',
    imageUrl: 'https://picsum.photos/id/1050/800/450',
    source: 'Cultura.ro',
    publishedAt: DateTime.now().subtract(const Duration(days: 1, hours: 3)),
    category: 'Cultură',
  ),
  Article(
    id: '6',
    title: 'Top 10 gadgeturi care merită în 2025',
    summary: 'O selecție a celor mai reușite dispozitive pentru productivitate și divertisment.',
    imageUrl: 'https://picsum.photos/id/1062/800/450',
    source: 'Gizmo',
    publishedAt: DateTime.now().subtract(const Duration(days: 1, hours: 6)),
    category: 'Tech',
  ),
];

const String _defaultApiKey = 'devkey'; // must match server API_KEY

class ApiClient {
  final String baseUrl;
  final String apiKey;
  final http.Client _client;

  ApiClient({String? baseUrl, String? apiKey, http.Client? client})
      : baseUrl = baseUrl ?? (kIsWeb ? 'https://stire.site/api' : 'http://10.0.2.2:8000'),
        apiKey = apiKey ?? _defaultApiKey,
        _client = client ?? http.Client();

  Future<List<Article>> fetchArticles({String? category, String? q, int offset = 0, int limit = 20}) async {
    final Uri uri = Uri.parse('$baseUrl/articles').replace(queryParameters: <String, String>{
      if (category != null) 'category': category,
      if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
      'offset': '$offset',
      'limit': '$limit',
    });
    final http.Response resp = await _client.get(uri);
    if (resp.statusCode != 200) {
      throw Exception('Eroare la încărcarea știrilor (${resp.statusCode})');
    }
    final List<dynamic> data = jsonDecode(resp.body) as List<dynamic>;
    return data.map((dynamic e) => Article.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<String>> fetchCategories() async {
    final Uri uri = Uri.parse('$baseUrl/categories');
    final http.Response resp = await _client.get(uri);
    if (resp.statusCode != 200) {
      throw Exception('Eroare la încărcarea categoriilor (${resp.statusCode})');
    }
    final List<dynamic> data = jsonDecode(resp.body) as List<dynamic>;
    return data.cast<String>();
  }

  Future<Article> createArticle({
    required String title,
    required String summary,
    required String imageUrl,
    required String source,
    required String category,
    DateTime? publishedAt,
  }) async {
    final Uri uri = Uri.parse('$baseUrl/articles');
    final Map<String, String> headers = <String, String>{
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    };
    final Map<String, dynamic> body = <String, dynamic>{
      'title': title,
      'summary': summary,
      'image_url': imageUrl,
      'source': source,
      'category': category,
      if (publishedAt != null) 'published_at': publishedAt.toUtc().toIso8601String(),
    };
    final http.Response resp = await _client.post(uri, headers: headers, body: jsonEncode(body));
    if (resp.statusCode != 200) {
      throw Exception('Eroare la creare articol (${resp.statusCode})');
    }
    final Map<String, dynamic> data = jsonDecode(resp.body) as Map<String, dynamic>;
    return Article.fromJson(data);
  }
}

class NewsHomePage extends StatefulWidget {
  const NewsHomePage({super.key});

  @override
  State<NewsHomePage> createState() => _NewsHomePageState();
}

class _NewsHomePageState extends State<NewsHomePage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late List<Article> _articles;
  bool _isRefreshing = false;
  late final ApiClient _api;
  late List<String> _categories;
  String _currentCategory = 'Toate';
  int _navIndex = 1; // default: Categorii (conform screenshot)

  @override
  void initState() {
    super.initState();
    _categories = List<String>.from(_fallbackCategories);
    _tabController = TabController(length: _categories.length, vsync: this);
    _articles = List<Article>.from(_mockArticles);
    _api = ApiClient();
    _loadFromApi();
    _loadCategories();
    _tabController.addListener(_onTabChanged);
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    await _loadFromApi(category: _currentCategory, showSpinner: true);
  }

  void _openSearch() {
    showSearch<Article?>(
      context: context,
      delegate: _ArticleSearchDelegate(all: _articles),
    );
  }

  Future<void> _openAdmin() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (BuildContext context) => AdminDashboardPage(
          baseUrl: _api.baseUrl,
          apiKey: _api.apiKey,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: NestedScrollView(
          headerSliverBuilder: (BuildContext context, bool innerBoxIsScrolled) {
            return <Widget>[
              SliverAppBar(
                title: const Text('Știri'),
                floating: true,
                snap: true,
                pinned: true,
                actions: <Widget>[
                  IconButton(
                    onPressed: _openSearch,
                    icon: const Icon(Icons.search),
                    tooltip: 'Caută',
                  ),
                  IconButton(
                    onPressed: _openAdmin,
                    icon: const Icon(Icons.admin_panel_settings_outlined),
                    tooltip: 'Admin',
                  ),
                ],
                bottom: TabBar(
                  controller: _tabController,
                  isScrollable: true,
                  tabAlignment: TabAlignment.start,
                  tabs: _categories
                      .map<Widget>((String c) => Tab(text: c))
                      .toList(),
                ),
              ),
            ];
          },
          body: TabBarView(
            controller: _tabController,
            children: _categories.map<Widget>((String category) {
              return _NewsList(
                allArticles: _articles,
                category: category,
                onRefresh: _refresh,
                isRefreshing: _isRefreshing,
              );
            }).toList(),
          ),
        ),
      floatingActionButton: null,
      bottomNavigationBar: AppDesign.buildBottomNav(
        currentIndex: _navIndex,
        onTap: _onNavTap,
      ),
    );
  }

  Future<void> _loadFromApi({String? category, bool showSpinner = false}) async {
    try {
      if (showSpinner) {
        setState(() {
          _isRefreshing = true;
        });
      }
      final String? catParam = (category != null && category != 'Toate') ? category : null;
      final List<Article> fresh = await _api.fetchArticles(category: catParam);
      setState(() {
        _articles = fresh;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Nu s-au putut încărca știrile: $e')),
        );
      }
    } finally {
      if (showSpinner && mounted) {
        setState(() {
          _isRefreshing = false;
        });
      }
    }
  }

  Future<void> _openCreatePage() async {
    final Article? created = await Navigator.of(context).push<Article>(
      MaterialPageRoute<Article>(
        builder: (BuildContext context) => CreateArticlePage(api: _api, categories: _categories.where((String c) => c != 'Toate').toList()),
      ),
    );
    if (created != null && mounted) {
      setState(() {
        _articles.insert(0, created);
        _tabController.index = 0; // switch to "Toate"
        _currentCategory = 'Toate';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Știre creată cu succes')),
      );
    }
  }

  Future<void> _loadCategories() async {
    try {
      final List<String> cats = await _api.fetchCategories();
      if (!mounted) return;
      if (cats.isEmpty) return;
      if (listEquals(cats, _categories)) return;
      final int oldIndex = _tabController.index;
      final TabController old = _tabController;
      setState(() {
        _categories = cats;
        _tabController = TabController(length: cats.length, vsync: this);
        _tabController.index = (oldIndex < cats.length) ? oldIndex : 0;
        _currentCategory = _categories[_tabController.index];
      });
      old.dispose();
      // reload with the new current category
      unawaited(_loadFromApi(category: _currentCategory));
    } catch (e) {
      // păstrăm fallback-ul dacă API-ul e indisponibil
    }
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;
    final String newCat = _categories[_tabController.index];
    if (newCat == _currentCategory) return;
    _currentCategory = newCat;
    unawaited(_loadFromApi(category: _currentCategory, showSpinner: true));
  }

  void _onNavTap(int index) {
    setState(() => _navIndex = index);
    switch (index) {
      case 0: // Acasă
        _tabController.index = 0;
        _currentCategory = 'Toate';
        unawaited(_loadFromApi(category: _currentCategory, showSpinner: true));
        break;
      case 1: // Categorii – rămâne pe ecranul curent
        break;
      case 2: // Salvate – placeholder
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('„Salvate” va fi disponibil în curând.')),
        );
        break;
      case 3: // Profil – placeholder
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('„Profil” va fi disponibil în curând.')),
        );
        break;
    }
  }
}

class _NewsList extends StatelessWidget {
  final List<Article> allArticles;
  final String category;
  final Future<void> Function() onRefresh;
  final bool isRefreshing;

  const _NewsList({
    required this.allArticles,
    required this.category,
    required this.onRefresh,
    required this.isRefreshing,
  });

  @override
  Widget build(BuildContext context) {
    final List<Article> items = category == 'Toate'
        ? allArticles
        : allArticles.where((Article a) => a.category == category).toList();

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.builder(
        padding: const EdgeInsets.only(bottom: 24),
        itemCount: items.length,
        itemBuilder: (BuildContext context, int index) {
          final Article article = items[index];
          return _NewsCard(article: article);
        },
      ),
    );
  }
}

class _NewsCard extends StatelessWidget {
  final Article article;

  const _NewsCard({required this.article});

  @override
  Widget build(BuildContext context) {
    final TextTheme textTheme = Theme.of(context).textTheme;
    final ColorScheme colors = Theme.of(context).colorScheme;

    return InkWell(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (BuildContext context) => ArticleDetailPage(article: article),
          ),
        );
      },
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: Card(
          clipBehavior: Clip.antiAlias,
          elevation: 1,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Stack(
                children: <Widget>[
                  AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Image.network(
                      article.imageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (BuildContext context, Object error, StackTrace? stackTrace) {
                        return Container(color: colors.surfaceContainerHighest);
                      },
                      loadingBuilder: (BuildContext context, Widget child, ImageChunkEvent? loadingProgress) {
                        if (loadingProgress == null) return child;
                        return Container(
                          color: colors.surfaceContainerHighest,
                          alignment: Alignment.center,
                          child: const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        );
                      },
                    ),
                  ),
                  Positioned(
                    left: 12,
                    top: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: colors.primary.withValues(alpha: 0.9),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        article.category,
                        style: textTheme.labelSmall?.copyWith(color: colors.onPrimary),
                      ),
                    ),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Text(
                  article.title,
                  style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Text(
                  article.summary,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.bodyMedium,
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 12, 16),
                child: Row(
                  children: <Widget>[
                    Icon(Icons.public, size: 16, color: colors.outline),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        '${article.source} · ${_formatRelativeTime(article.publishedAt)}',
                        style: textTheme.bodySmall?.copyWith(color: colors.onSurfaceVariant),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      onPressed: () {},
                      icon: const Icon(Icons.bookmark_border),
                      tooltip: 'Salvează',
                      splashRadius: 20,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ArticleDetailPage extends StatelessWidget {
  final Article article;

  const ArticleDetailPage({super.key, required this.article});

  @override
  Widget build(BuildContext context) {
    final TextTheme textTheme = Theme.of(context).textTheme;
    final ColorScheme colors = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(article.source),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.network(
                article.imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (BuildContext context, Object error, StackTrace? stackTrace) {
                  return Container(color: colors.surfaceContainerHighest);
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text(
                article.title,
                style: textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                '${article.source} · ${_formatRelativeTime(article.publishedAt)}',
                style: textTheme.bodySmall?.copyWith(color: colors.onSurfaceVariant),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              child: Text(
                article.summary,
                style: textTheme.bodyLarge,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ArticleSearchDelegate extends SearchDelegate<Article?> {
  final List<Article> all;

  _ArticleSearchDelegate({required this.all}) : super(searchFieldLabel: 'Caută știri');

  @override
  List<Widget>? buildActions(BuildContext context) {
    return <Widget>[
      if (query.isNotEmpty)
        IconButton(
          icon: const Icon(Icons.clear),
          onPressed: () {
            query = '';
            showSuggestions(context);
          },
          tooltip: 'Șterge',
        ),
    ];
  }

  @override
  Widget? buildLeading(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.arrow_back),
      onPressed: () => close(context, null),
      tooltip: 'Înapoi',
    );
  }

  @override
  Widget buildResults(BuildContext context) {
    final List<Article> results = _filter();
    return _SearchResults(results: results);
  }

  @override
  Widget buildSuggestions(BuildContext context) {
    final List<Article> results = _filter();
    return _SearchResults(results: results);
  }

  List<Article> _filter() {
    final String q = query.trim().toLowerCase();
    if (q.isEmpty) return all;
    return all.where((Article a) {
      return a.title.toLowerCase().contains(q) || a.summary.toLowerCase().contains(q);
    }).toList();
  }
}

class _SearchResults extends StatelessWidget {
  final List<Article> results;

  const _SearchResults({required this.results});

  @override
  Widget build(BuildContext context) {
    if (results.isEmpty) {
      return const Center(child: Text('Nicio știre găsită'));
    }
    return ListView.builder(
      itemCount: results.length,
      itemBuilder: (BuildContext context, int index) {
        return _NewsCard(article: results[index]);
      },
    );
  }
}

String _formatRelativeTime(DateTime dateTime) {
  final Duration diff = DateTime.now().difference(dateTime);
  if (diff.inMinutes < 1) return 'acum';
  if (diff.inMinutes < 60) return '${diff.inMinutes} min';
  if (diff.inHours < 24) return '${diff.inHours} h';
  if (diff.inDays < 7) return '${diff.inDays} zile';
  final int weeks = (diff.inDays / 7).floor();
  return weeks == 1 ? '1 săptămână' : '$weeks săpt.';
}

class CreateArticlePage extends StatefulWidget {
  final ApiClient api;
  final List<String> categories;

  const CreateArticlePage({super.key, required this.api, required this.categories});

  @override
  State<CreateArticlePage> createState() => _CreateArticlePageState();
}

class _CreateArticlePageState extends State<CreateArticlePage> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _titleCtrl = TextEditingController();
  final TextEditingController _summaryCtrl = TextEditingController();
  final TextEditingController _imageUrlCtrl = TextEditingController(text: 'https://picsum.photos/800/450');
  final TextEditingController _sourceCtrl = TextEditingController(text: 'Stirix');
  String? _selectedCategory;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _selectedCategory = widget.categories.isNotEmpty ? widget.categories.first : 'Tech';
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _summaryCtrl.dispose();
    _imageUrlCtrl.dispose();
    _sourceCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Creează știre')),
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
                  value: _selectedCategory,
                  isExpanded: true,
                  items: widget.categories.map<DropdownMenuItem<String>>((String c) => DropdownMenuItem<String>(value: c, child: Text(c))).toList(),
                  onChanged: (String? v) => setState(() => _selectedCategory = v),
                ),
              ),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.check),
              label: Text(_submitting ? 'Se salvează...' : 'Publică'),
            ),
            const SizedBox(height: 8),
            Text('Articolul va apărea pe prima pagină după publicare.', style: textTheme.bodySmall),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      final Article created = await widget.api.createArticle(
        title: _titleCtrl.text.trim(),
        summary: _summaryCtrl.text.trim(),
        imageUrl: _imageUrlCtrl.text.trim(),
        source: _sourceCtrl.text.trim(),
        category: _selectedCategory ?? 'Tech',
        publishedAt: DateTime.now(),
      );
      if (!mounted) return;
      Navigator.of(context).pop<Article>(created);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Eroare la publicare: $e')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}
