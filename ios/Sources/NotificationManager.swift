import Foundation
import UserNotifications

/// Schedules a single daily local reminder. No server or push certificate needed.
@MainActor
final class NotificationManager: ObservableObject {
    @Published var enabled = false
    @Published var hour = 9
    @Published var minute = 0
    @Published private(set) var denied = false

    private let identifier = "longevity.dailyReminder"
    private let center = UNUserNotificationCenter.current()

    private enum Keys {
        static let enabled = "reminder.enabled"
        static let hour = "reminder.hour"
        static let minute = "reminder.minute"
    }

    init() {
        let d = AppGroup.defaults
        enabled = d.bool(forKey: Keys.enabled)
        hour = d.object(forKey: Keys.hour) as? Int ?? 9
        minute = d.object(forKey: Keys.minute) as? Int ?? 0
    }

    func refreshAuthStatus() async {
        let settings = await center.notificationSettings()
        denied = settings.authorizationStatus == .denied
    }

    /// Turn the daily reminder on/off, requesting permission the first time.
    func setEnabled(_ on: Bool) async {
        enabled = on
        persist()
        if on {
            let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
            if granted {
                schedule()
            } else {
                enabled = false
                denied = true
                persist()
            }
        } else {
            center.removePendingNotificationRequests(withIdentifiers: [identifier])
        }
    }

    /// Re-schedule after the time changes (only if currently enabled).
    func updateTime(hour: Int, minute: Int) {
        self.hour = hour
        self.minute = minute
        persist()
        if enabled { schedule() }
    }

    private func schedule() {
        center.removePendingNotificationRequests(withIdentifiers: [identifier])

        let content = UNMutableNotificationContent()
        content.title = "Daily Protocol"
        content.body = "Time for your longevity stack — log your pillars and fasting window."
        content.sound = .default

        var components = DateComponents()
        components.hour = hour
        components.minute = minute
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)

        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
        center.add(request)
    }

    private func persist() {
        let d = AppGroup.defaults
        d.set(enabled, forKey: Keys.enabled)
        d.set(hour, forKey: Keys.hour)
        d.set(minute, forKey: Keys.minute)
    }
}
