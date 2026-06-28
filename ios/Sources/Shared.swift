import Foundation

/// App Group that lets the app and the home-screen widget share state.
enum AppGroup {
    static let id = "group.com.cjaynyc.longevitystack"
    static let snapshotKey = "longevityStack.v1"

    static var defaults: UserDefaults {
        UserDefaults(suiteName: id) ?? .standard
    }
}

/// One completed fasting window.
struct FastRecord: Codable, Identifiable {
    var id: Date { start }   // start time is unique enough to key on
    var start: Date
    var end: Date

    var duration: TimeInterval { end.timeIntervalSince(start) }
    var hours: Double { duration / 3600 }
}

/// The single persisted record, shared by the app and widget.
struct StackSnapshot: Codable {
    var fastStart: Date?
    var goalHours: Int = 14
    var bestFastHours: Int = 0
    var motionStepGoal: Int = 6000
    var pillarsByDay: [String: [String: Bool]] = [:]
    var fastHistory: [FastRecord] = []

    static let pillarIDs = ["breath", "ellagi", "thermal", "motion"]

    // MARK: Day keys

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar.current
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func dayKey(_ date: Date = Date()) -> String {
        dayFormatter.string(from: date)
    }

    static func prevDayKey(_ key: String) -> String {
        guard let d = dayFormatter.date(from: key),
              let p = Calendar.current.date(byAdding: .day, value: -1, to: d) else { return key }
        return dayFormatter.string(from: p)
    }

    static func date(from key: String) -> Date? {
        dayFormatter.date(from: key)
    }

    // MARK: Derived

    var completedToday: Int {
        let rec = pillarsByDay[StackSnapshot.dayKey()] ?? [:]
        return StackSnapshot.pillarIDs.filter { rec[$0] == true }.count
    }

    func isComplete(day: String) -> Bool {
        let rec = pillarsByDay[day] ?? [:]
        return StackSnapshot.pillarIDs.allSatisfy { rec[$0] == true }
    }

    /// Consecutive fully-complete days ending today (or yesterday if today isn't done yet).
    var streak: Int {
        var count = 0
        var key = StackSnapshot.dayKey()
        if !isComplete(day: key) { key = StackSnapshot.prevDayKey(key) }
        while isComplete(day: key) {
            count += 1
            key = StackSnapshot.prevDayKey(key)
        }
        return count
    }

    var fastElapsed: TimeInterval {
        fastStart.map { Date().timeIntervalSince($0) } ?? 0
    }

    var fastFraction: Double {
        guard fastStart != nil, goalHours > 0 else { return 0 }
        return min(1, fastElapsed / (Double(goalHours) * 3600))
    }
}

func loadSnapshot() -> StackSnapshot {
    guard let data = AppGroup.defaults.data(forKey: AppGroup.snapshotKey),
          let snap = try? JSONDecoder().decode(StackSnapshot.self, from: data) else {
        return StackSnapshot()
    }
    return snap
}

func saveSnapshot(_ snapshot: StackSnapshot) {
    if let data = try? JSONEncoder().encode(snapshot) {
        AppGroup.defaults.set(data, forKey: AppGroup.snapshotKey)
    }
}
