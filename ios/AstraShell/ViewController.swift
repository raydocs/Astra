//
//  ViewController.swift
//  AstraShell
//
//  Created by Ruirui on 3/25/26.
//

import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    private let bootstrapStatusLabel = UILabel()

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self
        self.webView.scrollView.isScrollEnabled = false

        self.webView.configuration.userContentController.add(self, name: "controller")

        setupBootstrapStatusLabel()
        observeBootstrapUpdates()
        renderBootstrapState(HostBridgeBootstrapStore.shared.latestState)

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    private func setupBootstrapStatusLabel() {
        bootstrapStatusLabel.translatesAutoresizingMaskIntoConstraints = false
        bootstrapStatusLabel.numberOfLines = 0
        bootstrapStatusLabel.font = .systemFont(ofSize: 12)
        bootstrapStatusLabel.textColor = .secondaryLabel
        bootstrapStatusLabel.backgroundColor = UIColor.secondarySystemBackground.withAlphaComponent(0.9)
        bootstrapStatusLabel.layer.cornerRadius = 8
        bootstrapStatusLabel.layer.masksToBounds = true
        bootstrapStatusLabel.textAlignment = .left

        view.addSubview(bootstrapStatusLabel)

        NSLayoutConstraint.activate([
            bootstrapStatusLabel.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 12),
            bootstrapStatusLabel.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -12),
            bootstrapStatusLabel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12)
        ])
    }

    private func observeBootstrapUpdates() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleBootstrapUpdate(_:)),
            name: .hostBootstrapDidUpdate,
            object: nil
        )
    }

    @objc
    private func handleBootstrapUpdate(_ notification: Notification) {
        renderBootstrapState(notification.object as? HostBootstrapState)
    }

    private func renderBootstrapState(_ state: HostBootstrapState?) {
        if let state {
            let recent = HostBridgeBootstrapStore.shared.history.prefix(3).map { item in
                let time = item.issuedAt ?? "unknown"
                return "  - \(item.sessionId) (\(item.source), \(time))"
            }.joined(separator: "\n")

            bootstrapStatusLabel.text = """
              Bootstrap received
              \(state.statusText)
              History: \(HostBridgeBootstrapStore.shared.history.count)
            \(recent.isEmpty ? "  - (empty)" : recent)
            """
        } else {
            bootstrapStatusLabel.text = "  Waiting for bootstrap deep link\n  astra-shell://bootstrap?sessionId=..."
        }

        publishBootstrapToWebView(state)
    }

    private func publishBootstrapToWebView(_ state: HostBootstrapState?) {
        let payload = state?.asDictionary ?? [:]
        let historyPayload = HostBridgeBootstrapStore.shared.historyAsDictionaries

        guard let stateData = try? JSONSerialization.data(withJSONObject: payload),
              let stateJson = String(data: stateData, encoding: .utf8),
              let historyData = try? JSONSerialization.data(withJSONObject: historyPayload),
              let historyJson = String(data: historyData, encoding: .utf8) else {
            return
        }

        let script = """
        window.AstraHostBootstrap = \(stateJson);
        window.AstraHostBootstrapHistory = \(historyJson);
        window.dispatchEvent(new CustomEvent('astra-host-bootstrap', { detail: window.AstraHostBootstrap }));
        window.dispatchEvent(new CustomEvent('astra-host-bootstrap-history', { detail: window.AstraHostBootstrapHistory }));
        """

        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        publishBootstrapToWebView(HostBridgeBootstrapStore.shared.latestState)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Override point for customization.
    }

}
