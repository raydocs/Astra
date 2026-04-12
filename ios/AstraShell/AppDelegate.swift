//
//  AppDelegate.swift
//  AstraShell
//
//  Created by Ruirui on 3/25/26.
//

import UIKit

struct HostBootstrapState {
    let sessionId: String
    let source: String
    let issuedAt: String?
    let rawURL: String

    var statusText: String {
        var parts = ["Session \(sessionId)", "source: \(source)"]
        if let issuedAt, !issuedAt.isEmpty {
            parts.append("issuedAt: \(issuedAt)")
        }
        return parts.joined(separator: " • ")
    }

    var asDictionary: [String: Any] {
        [
            "sessionId": sessionId,
            "source": source,
            "issuedAt": issuedAt ?? NSNull(),
            "rawURL": rawURL,
            "statusText": statusText
        ]
    }
}

extension Notification.Name {
    static let hostBootstrapDidUpdate = Notification.Name("HostBootstrapDidUpdate")
}

final class HostBridgeBootstrapStore {
    static let shared = HostBridgeBootstrapStore()

    private(set) var latestState: HostBootstrapState?
    private(set) var history: [HostBootstrapState] = []
    private let maxHistoryCount = 10

    private init() {}

    @discardableResult
    func consume(url: URL) -> Bool {
        guard let state = Self.parseBootstrapURL(url) else {
            return false
        }

        latestState = state
        history.insert(state, at: 0)
        if history.count > maxHistoryCount {
            history = Array(history.prefix(maxHistoryCount))
        }

        NotificationCenter.default.post(name: .hostBootstrapDidUpdate, object: state)
        return true
    }

    static func parseBootstrapURL(_ url: URL) -> HostBootstrapState? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }

        let scheme = components.scheme?.lowercased()
        let host = components.host?.lowercased()
        let path = components.path.lowercased()
        guard scheme == "astra-shell", host == "bootstrap" || path == "/bootstrap" else {
            return nil
        }

        let items = components.queryItems ?? []
        let sessionId = items.first(where: { $0.name == "sessionId" || $0.name == "session" })?.value?.trimmingCharacters(in: .whitespacesAndNewlines)
        let source = items.first(where: { $0.name == "source" })?.value?.trimmingCharacters(in: .whitespacesAndNewlines)
        let issuedAt = items.first(where: { $0.name == "issuedAt" || $0.name == "ts" })?.value?.trimmingCharacters(in: .whitespacesAndNewlines)

        guard let sessionId, !sessionId.isEmpty else {
            return nil
        }

        return HostBootstrapState(
            sessionId: sessionId,
            source: (source?.isEmpty == false ? source! : "unknown"),
            issuedAt: issuedAt,
            rawURL: url.absoluteString
        )
    }

    var historyAsDictionaries: [[String: Any]] {
        history.map { $0.asDictionary }
    }
}

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        if let launchURL = launchOptions?[.url] as? URL {
            _ = HostBridgeBootstrapStore.shared.consume(url: launchURL)
        }
        return true
    }

    func application(_ application: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        HostBridgeBootstrapStore.shared.consume(url: url)
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

}
