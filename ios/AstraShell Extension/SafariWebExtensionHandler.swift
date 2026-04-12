//
//  SafariWebExtensionHandler.swift
//  AstraShell Extension
//
//  Created by Ruirui on 3/25/26.
//

import Foundation
import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    private static var lastBootstrapSessionId: String?
    private static var lastBootstrapAt: String?
    private static var bootstrapHistory: [[String: Any]] = []
    private static let maxHistoryCount = 20

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@ (profile: %@)", String(describing: message), profile?.uuidString ?? "none")

        let responseBody = handleMessage(message)

        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: responseBody]
        } else {
            response.userInfo = ["message": responseBody]
        }

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

    private func handleMessage(_ message: Any?) -> [String: Any] {
        guard let body = message as? [String: Any] else {
            return ["echo": message as Any]
        }

        let type = (body["type"] as? String) ?? (body["command"] as? String)

        switch type {
        case "sessionBootstrap":
            return handleSessionBootstrap(body)
        case "bootstrapStatus":
            return [
                "ok": true,
                "type": "bootstrapStatus",
                "lastSessionId": Self.lastBootstrapSessionId ?? NSNull(),
                "lastBootstrapAt": Self.lastBootstrapAt ?? NSNull()
            ]
        case "bootstrapHistory":
            return handleBootstrapHistory(body)
        default:
            return ["echo": message as Any]
        }
    }

    private func handleSessionBootstrap(_ body: [String: Any]) -> [String: Any] {
        let sessionId = ((body["sessionId"] as? String) ?? (body["session"] as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sessionId.isEmpty else {
            return [
                "ok": false,
                "type": "sessionBootstrapAck",
                "error": "missing_session_id"
            ]
        }

        let source = ((body["source"] as? String) ?? "safari-extension").trimmingCharacters(in: .whitespacesAndNewlines)
        let issuedAt = ISO8601DateFormatter().string(from: Date())

        Self.lastBootstrapSessionId = sessionId
        Self.lastBootstrapAt = issuedAt

        let launchURLString = "astra-shell://bootstrap?sessionId=\(urlEncode(sessionId))&source=\(urlEncode(source))&issuedAt=\(urlEncode(issuedAt))"
        Self.pushHistoryEvent([
            "sessionId": sessionId,
            "source": source,
            "issuedAt": issuedAt,
            "launchURL": launchURLString
        ])

        return [
            "ok": true,
            "type": "sessionBootstrapAck",
            "sessionId": sessionId,
            "source": source,
            "issuedAt": issuedAt,
            "launchURL": launchURLString,
            "note": "Open launchURL to hand off bootstrap state to the host app."
        ]
    }

    private func handleBootstrapHistory(_ body: [String: Any]) -> [String: Any] {
        let requestedLimit: Int
        if let value = body["limit"] as? NSNumber {
            requestedLimit = value.intValue
        } else {
            requestedLimit = 10
        }

        let limit = max(1, min(requestedLimit, Self.maxHistoryCount))
        let events = Array(Self.bootstrapHistory.prefix(limit))

        return [
            "ok": true,
            "type": "bootstrapHistory",
            "events": events
        ]
    }

    private static func pushHistoryEvent(_ event: [String: Any]) {
        bootstrapHistory.insert(event, at: 0)
        if bootstrapHistory.count > maxHistoryCount {
            bootstrapHistory = Array(bootstrapHistory.prefix(maxHistoryCount))
        }
    }

    private func urlEncode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
    }

}
