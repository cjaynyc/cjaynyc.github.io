import SwiftUI

@main
struct LongevityStackApp: App {
    @StateObject private var state = AppState()

    var body: some Scene {
        WindowGroup {
            DashboardView()
                .environmentObject(state)
                .preferredColorScheme(.dark)
        }
    }
}
