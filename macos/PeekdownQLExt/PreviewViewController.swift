import Cocoa
import Quartz
import WebKit

@objc(PreviewViewController)
final class PreviewViewController: NSViewController, QLPreviewingController {
    private var webView: WKWebView!
    private var backgroundView: NSVisualEffectView!

    override func loadView() {
        let background = NSVisualEffectView()
        background.material = .hudWindow
        background.blendingMode = .behindWindow
        background.state = .active
        background.translatesAutoresizingMaskIntoConstraints = false
        backgroundView = background

        let config = WKWebViewConfiguration()
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.setValue(false, forKey: "drawsBackground")
        self.webView = webView

        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(background)
        container.addSubview(webView)

        NSLayoutConstraint.activate([
            background.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            background.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            background.topAnchor.constraint(equalTo: container.topAnchor),
            background.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])

        view = container
    }

    func preparePreviewOfFile(at url: URL, completionHandler handler: @escaping (Error?) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            let markdown = (try? String(contentsOf: url, encoding: .utf8)) ?? ""
            let html = self.makeHTML(markdown: markdown)
            DispatchQueue.main.async {
                self.webView.loadHTMLString(html, baseURL: url.deletingLastPathComponent())
                handler(nil)
            }
        }
    }

    private func makeHTML(markdown: String) -> String {
        let markdownJSON = Self.jsonString(for: markdown)
        let css = Self.loadResource(named: "preview", extension: "css")
        let markdownIt = Self.loadResource(named: "markdown-it.min", extension: "js")
        let domPurify = Self.loadResource(named: "purify.min", extension: "js")
        let mermaid = Self.loadResource(named: "mermaid.min", extension: "js")

        if css.isEmpty || markdownIt.isEmpty || domPurify.isEmpty || mermaid.isEmpty {
            let escaped = Self.escapeHTML(markdown)
            return """
            <!doctype html>
            <html>
            <head>
                <meta charset=\"utf-8\">
                <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
                <style>\(css)</style>
            </head>
            <body>
                <pre>\(escaped)</pre>
            </body>
            </html>
            """
        }

        return """
        <!doctype html>
        <html>
        <head>
            <meta charset=\"utf-8\">
            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
            <style>\(css)</style>
        </head>
        <body>
            <div id=\"content\" class=\"markdown-body\"></div>
            <script>\(markdownIt)</script>
            <script>\(domPurify)</script>
            <script>\(mermaid)</script>
            <script>
            (() => {
                const source = \(markdownJSON);
                const md = window.markdownit({
                    html: true,
                    linkify: true,
                    typographer: true
                });
                const originalFence = md.renderer.rules.fence || function(tokens, idx, options, env, self) {
                    return self.renderToken(tokens, idx, options);
                };
                md.renderer.rules.fence = function(tokens, idx, options, env, self) {
                    const token = tokens[idx];
                    const info = (token.info || '').trim().toLowerCase();
                    if (info === 'mermaid') {
                        return '<div class=\"mermaid\">' + token.content + '</div>';
                    }
                    return originalFence(tokens, idx, options, env, self);
                };

                const raw = md.render(source);
                const sanitized = DOMPurify.sanitize(raw, {
                    USE_PROFILES: { html: true, svg: true, svgFilters: true }
                });
                const container = document.getElementById('content');
                container.innerHTML = sanitized;

                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: 'strict',
                    theme: prefersDark ? 'dark' : 'default'
                });
                mermaid.run({ querySelector: '.mermaid' }).catch(() => {
                    const warning = document.createElement('div');
                    warning.className = 'mermaid-error';
                    warning.textContent = 'Mermaid failed to render.';
                    container.prepend(warning);
                });
            })();
            </script>
        </body>
        </html>
        """
    }

    private static func loadResource(named name: String, extension ext: String) -> String {
        let bundle = Bundle(for: PreviewViewController.self)
        guard let url = bundle.url(forResource: name, withExtension: ext),
              let data = try? Data(contentsOf: url),
              let content = String(data: data, encoding: .utf8) else {
            return ""
        }
        return content
    }

    private static func escapeHTML(_ value: String) -> String {
        return value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }

    private static func jsonString(for value: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: value, options: [])
        return String(data: data ?? Data("\"\"".utf8), encoding: .utf8) ?? "\"\""
    }
}
