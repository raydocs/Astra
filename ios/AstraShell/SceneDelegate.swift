//
//  SceneDelegate.swift
//  AstraShell
//
//  Created by Ruirui on 3/25/26.
//

import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let _ = (scene as? UIWindowScene) else { return }

        if let urlContext = connectionOptions.urlContexts.first {
            _ = HostBridgeBootstrapStore.shared.consume(url: urlContext.url)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else {
            return
        }

        _ = HostBridgeBootstrapStore.shared.consume(url: url)
    }

}
